import Decimal from "decimal.js";
import { NextResponse } from "next/server";
import { handleApiError, readJson, withRetry } from "@/lib/api";
import { parseDateOnly } from "@/lib/dates";
import { sendPaymentReceipt } from "@/lib/email";
import { NotFoundError, ValidationError } from "@/lib/errors";
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

      const paymentType = body.paymentType || (() => {
        const remaining = account.schedule
          .filter((s) => s.status !== "PAID")
          .reduce((sum, s) => {
            const ramt = new Decimal(s.amount).minus(s.paidAmount ? new Decimal(s.paidAmount) : 0);
            return sum.plus(ramt).plus(new Decimal(s.penaltyAmount));
          }, new Decimal(0));

        if (totalAmount.gte(remaining)) return "FULL";
        const monthly = new Decimal(account.monthlyInstallment);
        if (totalAmount.lt(monthly)) return "PARTIAL";
        return "REGULAR";
      })();

      // ADVANCE is same as REGULAR now — both apply forward

      const currentPeriod = account.schedule.find(
        (s) => s.status === "PENDING" || s.status === "PARTIAL" || s.status === "OVERDUE",
      );

      if (!currentPeriod) {
        throw new NotFoundError("No unpaid periods found");
      }

      // Update overdue schedule periods before processing
      const paymentDateManila = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Manila",
      }).format(paymentDate);
      const paymentDateMidnight = new Date(paymentDateManila + "T00:00:00.000+08:00");

      await tx.installmentSchedule.updateMany({
        where: {
          installmentAccountId: account.id,
          status: { in: ["PENDING"] },
          dueDate: { lt: paymentDateMidnight },
        },
        data: { status: "OVERDUE" },
      });

      // Update in-memory schedule instead of re-fetching from DB
      for (const s of account.schedule) {
        if (s.status === "PENDING" && s.dueDate < paymentDateMidnight) {
          s.status = "OVERDUE";
        }
      }
      const updatedSchedule = account.schedule;

      // Reject overpayments — cannot pay more than the total remaining balance
      {
        const maxPayable = updatedSchedule
          .filter((s) => s.status !== "PAID")
          .reduce((sum, s) => {
            const remainingAmt = new Decimal(s.amount).minus(
              s.paidAmount ? new Decimal(s.paidAmount) : 0,
            );
            return sum.plus(remainingAmt).plus(new Decimal(s.penaltyAmount));
          }, new Decimal(0));

        if (totalAmount.gt(maxPayable)) {
          throw new ValidationError(
            `Enter the exact amount of ₱${maxPayable.toFixed(2)}. Overpayment is not allowed.`,
          );
        }
      }

      // FULL: validate amount covers remaining balance (after overdue update)
      if (paymentType === "FULL") {
        const remaining = updatedSchedule
          .filter((s) => s.status !== "PAID")
          .reduce((sum, s) => {
            const remainingAmt = new Decimal(s.amount).minus(s.paidAmount ? new Decimal(s.paidAmount) : 0);
            return sum.plus(remainingAmt).plus(new Decimal(s.penaltyAmount));
          }, new Decimal(0));

        if (totalAmount.lt(remaining)) {
          throw new ValidationError(`FULL payment requires at least ₱${remaining.toFixed(2)} (remaining balance)`);
        }
      }

      // First pass: compute allocation only (no DB writes)
      let remainingToApply = totalAmount;
      let totalPenalty = new Decimal(0);
      const penaltyByPeriod: Record<string, string> = {};
      const principalByPeriod: Record<string, string> = {};
      const computedPeriods: Array<{
        period: (typeof updatedSchedule)[0];
        newPaidAmount: Decimal;
        newPenaltyAmount: Decimal;
        penaltyCovered: Decimal;
        principalCovered: Decimal;
        isPaid: boolean;
      }> = [];

      for (const period of updatedSchedule) {
        if (remainingToApply.lte(0)) break;
        if (period.status === "PAID") continue;

        const periodPenalty = new Decimal(period.penaltyAmount);
        const remainingPeriodAmount = new Decimal(period.amount).minus(
          period.paidAmount ? new Decimal(period.paidAmount) : 0,
        );
        const periodTotalDue = remainingPeriodAmount.plus(periodPenalty);

        const paidForPeriod = Decimal.min(remainingToApply, periodTotalDue);

        const principalCovered = Decimal.min(paidForPeriod, remainingPeriodAmount);
        const penaltyCovered = paidForPeriod.minus(principalCovered);
        if (penaltyCovered.gt(0)) {
          penaltyByPeriod[period.id] = decimalToString(penaltyCovered);
        }
        if (principalCovered.gt(0)) {
          principalByPeriod[period.id] = decimalToString(principalCovered);
        }
        totalPenalty = totalPenalty.plus(penaltyCovered);

        const newPaidAmount = (period.paidAmount
          ? new Decimal(period.paidAmount)
          : new Decimal(0)
        ).plus(principalCovered);

        const newPenaltyAmount = periodPenalty.minus(penaltyCovered);

        if (paidForPeriod.gt(0)) {
          computedPeriods.push({
            period,
            newPaidAmount,
            newPenaltyAmount,
            penaltyCovered,
            principalCovered,
            isPaid: paidForPeriod.gte(periodTotalDue),
          });
        }

        remainingToApply = remainingToApply.minus(paidForPeriod);

        if (paymentType === "PARTIAL") break;
      }

      // Create payment with REAL totalPenalty and per-period breakdown
      const createdPayment = await tx.payment.create({
        data: {
          installmentAccountId: body.installmentAccountId,
          customerName: account.customerName,
          totalAmount: decimalToString(totalAmount),
          paymentDate,
          method: body.method,
          paymentType,
          penaltyAmount: decimalToString(totalPenalty),
          penaltyBreakdown: Object.keys(penaltyByPeriod).length > 0 ? penaltyByPeriod : undefined,
          principalBreakdown: Object.keys(principalByPeriod).length > 0 ? principalByPeriod : undefined,
          notes: body.notes || null,
          cashier: body.cashier || null,
          proofUrl: body.proofUrl || null,
        },
      });

      // Second pass: write schedule updates with REAL paymentId (no __pending__)
      await Promise.all(
        computedPeriods.map(({ period, newPaidAmount, newPenaltyAmount, isPaid }) =>
          tx.installmentSchedule.update({
            where: { id: period.id },
            data: {
              status: isPaid ? "PAID" : "PARTIAL",
              paidDate: paymentDate,
              paymentId: createdPayment.id,
              paidAmount: decimalToString(newPaidAmount),
              penaltyAmount: decimalToString(newPenaltyAmount),
            },
          }),
        ),
      );

      // --- RECALCULATE REMAINING BALANCE ---
      await recalculateBalance(tx, account.id);

      return createdPayment;
    }));

    const serialized = serializePayment(payment);

    // Fire-and-forget email (do not block response)
    sendReceiptEmail(body.installmentAccountId, payment, serialized);

    return NextResponse.json({ payment: serialized }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

async function sendReceiptEmail(accountId: string, payment: any, serialized: any) {
  try {
    const account = await prisma.installmentAccount.findUnique({
      where: { id: accountId },
    });
    if (!account?.customerEmail) return;

    const allPayments = await prisma.payment.findMany({
      where: { installmentAccountId: accountId, voided: false },
    });
    const totalPaid = allPayments.reduce((sum, p) => sum.plus(new Decimal(p.totalAmount)), new Decimal(0));

    const paidCount = await prisma.installmentSchedule.count({
      where: { installmentAccountId: accountId, status: "PAID" },
    });
    const totalPeriods = account.scheduleType === "SEMI_MONTHLY" ? account.term * 2 : account.term;

    sendPaymentReceipt({
      customerEmail: account.customerEmail,
      customerName: account.customerName,
      customerAddress: account.customerAddress,
      customerPhone: account.customerPhone,
      paymentId: payment.id,
      paymentDate: serialized.paymentDate,
      paymentType: payment.paymentType,
      method: payment.method,
      totalAmount: serialized.totalAmount,
      penaltyAmount: serialized.penaltyAmount,
      remainingBalance: account.remainingBalance.toString(),
      totalPaid: totalPaid.toFixed(2),
      brand: account.brand,
      model: account.model,
      unitDescription: account.unitDescription,
      monthlyInstallment: account.monthlyInstallment.toString(),
      scheduleType: account.scheduleType,
      paidCount,
      totalPeriods,
      notes: payment.notes,
      cashier: payment.cashier,
    }).catch((err) => console.error("Receipt email failed:", err));
  } catch {
    // Silently ignore email failures
  }
}
