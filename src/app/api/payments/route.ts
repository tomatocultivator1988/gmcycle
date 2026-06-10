import Decimal from "decimal.js";
import { NextResponse } from "next/server";
import { handleApiError, readJson, withRetry } from "@/lib/api";
import { parseDateOnly } from "@/lib/dates";
import { sendPaymentReceipt } from "@/lib/email";
import { NotFoundError } from "@/lib/errors";
import { decimalToString } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { recalculateBalance } from "@/lib/balance";
import { serializePayment } from "@/lib/serializers";
import { createPaymentSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 20));

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where: { voided: false },
        orderBy: { paymentDate: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.payment.count({ where: { voided: false } }),
    ]);

    return NextResponse.json({
      payments: payments.map(serializePayment),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = createPaymentSchema.parse(await readJson(request));
    const paymentDate = parseDateOnly(body.paymentDate, "paymentDate");

    const payment = await withRetry(() => prisma.$transaction(async (tx) => {
      const account = await tx.installmentAccount.findUnique({
        where: { id: body.installmentAccountId },
        include: { schedule: { orderBy: { periodNumber: "asc" } } },
      });

      if (!account) {
        throw new NotFoundError("Installment account not found");
      }

      if (account.status === "APPLIED") {
        throw new NotFoundError("Cannot post payment to an APPLIED account — activate first");
      }

      if (account.status === "CLOSED" || account.status === "FULLY_PAID") {
        throw new NotFoundError("Cannot post payment to a CLOSED or FULLY_PAID account");
      }

      const totalAmount = new Decimal(body.totalAmount);
      const paymentType = body.paymentType;

      const currentPeriod = account.schedule.find(
        (s) => s.status === "PENDING" || s.status === "PARTIAL",
      );

      if (!currentPeriod) {
        throw new NotFoundError("No unpaid periods found");
      }

      // FULL: validate amount covers remaining balance
      if (paymentType === "FULL") {
        const remaining = account.schedule
          .filter((s) => s.status !== "PAID")
          .reduce((sum, s) => {
            const remainingAmt = new Decimal(s.amount).minus(s.paidAmount ? new Decimal(s.paidAmount) : 0);
            return sum.plus(remainingAmt).plus(new Decimal(s.penaltyAmount));
          }, new Decimal(0));

        if (totalAmount.lt(remaining)) {
          throw new Error(`FULL payment requires at least ₱${remaining.toFixed(2)} (remaining balance)`);
        }
      }

      // Update overdue schedule periods before processing
      await tx.installmentSchedule.updateMany({
        where: {
          installmentAccountId: account.id,
          status: "PENDING",
          dueDate: { lt: paymentDate },
        },
        data: { status: "OVERDUE" },
      });

      const updatedSchedule = await tx.installmentSchedule.findMany({
        where: { installmentAccountId: account.id },
        orderBy: { periodNumber: "asc" },
      });

      let remainingToApply = totalAmount;
      let totalPenalty = new Decimal(0);

      for (const period of updatedSchedule) {
        if (remainingToApply.lte(0)) break;
        if (period.status === "PAID") continue;

        const periodPenalty = new Decimal(period.penaltyAmount);
        const remainingPeriodAmount = new Decimal(period.amount).minus(
          period.paidAmount ? new Decimal(period.paidAmount) : 0,
        );
        const periodTotalDue = remainingPeriodAmount.plus(periodPenalty);

        const paidForPeriod = Decimal.min(remainingToApply, periodTotalDue);

        // Only count penalty if the payment covers the penalty portion
        const penaltyCovered = paidForPeriod.gt(remainingPeriodAmount)
          ? Decimal.min(periodPenalty, paidForPeriod.minus(remainingPeriodAmount))
          : new Decimal(0);
        totalPenalty = totalPenalty.plus(penaltyCovered);

        const newPaidAmount = (period.paidAmount
          ? new Decimal(period.paidAmount)
          : new Decimal(0)
        ).plus(paidForPeriod);

        if (paidForPeriod.gte(periodTotalDue)) {
          await tx.installmentSchedule.update({
            where: { id: period.id },
            data: {
              status: "PAID",
              paidDate: paymentDate,
              paymentId: "__pending__",
              paidAmount: decimalToString(newPaidAmount),
            },
          });
        } else if (paidForPeriod.gt(0)) {
          await tx.installmentSchedule.update({
            where: { id: period.id },
            data: {
              status: "PARTIAL",
              paidDate: paymentDate,
              paymentId: "__pending__",
              paidAmount: decimalToString(newPaidAmount),
            },
          });
        }

        remainingToApply = remainingToApply.minus(paidForPeriod);

        // REGULAR/PARTIAL: stop after first period
        if (paymentType === "REGULAR" || paymentType === "PARTIAL") {
          break;
        }
      }

      // Mark all as PAID for FULL payments
      if (paymentType === "FULL") {
        await tx.installmentSchedule.updateMany({
          where: {
            installmentAccountId: account.id,
            status: { in: ["PENDING", "PARTIAL", "OVERDUE"] },
          },
          data: {
            status: "PAID",
            paidDate: paymentDate,
            paymentId: "__pending__",
          },
        });
      }

      const createdPayment = await tx.payment.create({
        data: {
          installmentAccountId: body.installmentAccountId,
          customerName: account.customerName,
          totalAmount: decimalToString(totalAmount),
          paymentDate,
          method: body.method,
          paymentType: body.paymentType,
          penaltyAmount: decimalToString(totalPenalty),
          notes: body.notes || null,
          cashier: body.cashier || null,
          proofUrl: body.proofUrl || null,
        },
      });

      await tx.installmentSchedule.updateMany({
        where: {
          installmentAccountId: account.id,
          paymentId: "__pending__",
        },
        data: { paymentId: createdPayment.id },
      });

      // --- RECALCULATE REMAINING BALANCE ---
      await recalculateBalance(tx, account.id);

      return createdPayment;
    }));

    const serialized = serializePayment(payment);

    const account = await prisma.installmentAccount.findUnique({
      where: { id: body.installmentAccountId },
    });

    if (account?.customerEmail) {
      const allPayments = await prisma.payment.findMany({
        where: { installmentAccountId: body.installmentAccountId, voided: false },
      });
      const totalPaid = allPayments.reduce((sum, p) => sum.plus(new Decimal(p.totalAmount)), new Decimal(0));
      const latestBalance = account.remainingBalance;

      sendPaymentReceipt({
        customerEmail: account.customerEmail,
        customerName: account.customerName,
        paymentId: payment.id,
        paymentDate: serialized.paymentDate,
        paymentType: payment.paymentType,
        method: payment.method,
        totalAmount: serialized.totalAmount,
        penaltyAmount: serialized.penaltyAmount,
        remainingBalance: latestBalance.toString(),
        totalPaid: totalPaid.toFixed(2),
        brand: account.brand,
        model: account.model,
        unitDescription: account.unitDescription,
        monthlyInstallment: account.monthlyInstallment.toString(),
        notes: payment.notes,
        cashier: payment.cashier,
      }).catch((err) => console.error("Receipt email failed:", err));
    }

    return NextResponse.json({ payment: serialized }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
