import Decimal from "decimal.js";
import { NextResponse } from "next/server";
import { handleApiError, readJson, withRetry } from "@/lib/api";
import { parseDateOnly } from "@/lib/dates";
import { NotFoundError } from "@/lib/errors";
import { decimalToString } from "@/lib/money";
import { prisma } from "@/lib/prisma";
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
        orderBy: { paymentDate: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.payment.count(),
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

      const totalAmount = new Decimal(body.totalAmount);

      const currentPeriod = account.schedule.find(
        (s) => s.status === "PENDING" || s.status === "PARTIAL",
      );

      if (!currentPeriod) {
        throw new NotFoundError("No unpaid periods found");
      }



      // --- CREATE PAYMENT ---
      const createdPayment = await tx.payment.create({
        data: {
          installmentAccountId: body.installmentAccountId,
          customerName: account.customerName,
          totalAmount: decimalToString(totalAmount),
          paymentDate,
          method: body.method,
          paymentType: body.paymentType,
          penaltyAmount: "0.00",
          discountAmount: "0.00",
          notes: body.notes || null,
          cashier: body.cashier || null,
          proofUrl: body.proofUrl || null,
        },
      });

      // --- APPLY PAYMENT TO SCHEDULE PERIODS ---
      let remainingToApply = totalAmount;

      for (const period of account.schedule) {
        if (remainingToApply.lte(0)) break;
        if (period.status === "PAID") continue;

        const periodPenalty = new Decimal(period.penaltyAmount);
        const periodBaseAmount = new Decimal(period.amount);
        const periodTotalDue = periodBaseAmount.plus(periodPenalty);

        const paidForPeriod = Decimal.min(remainingToApply, periodTotalDue);

        if (paidForPeriod.gte(periodTotalDue)) {
          await tx.installmentSchedule.update({
            where: { id: period.id },
            data: {
              status: "PAID",
              paidDate: paymentDate,
              paymentId: createdPayment.id,
              paidAmount: decimalToString(paidForPeriod),
            },
          });
        } else if (paidForPeriod.gt(0)) {
          await tx.installmentSchedule.update({
            where: { id: period.id },
            data: {
              status: "PARTIAL",
              paidDate: paymentDate,
              paymentId: createdPayment.id,
              paidAmount: decimalToString(paidForPeriod),
            },
          });
        }

        remainingToApply = remainingToApply.minus(paidForPeriod);
      }

      // --- RECALCULATE REMAINING BALANCE ---
      const allSchedule = await tx.installmentSchedule.findMany({
        where: { installmentAccountId: account.id },
      });

      const newBalance = allSchedule
        .filter((s) => s.status === "PENDING" || s.status === "PARTIAL")
        .reduce(
          (sum, s) => sum.plus(new Decimal(s.amount)).plus(new Decimal(s.penaltyAmount)),
          new Decimal(0),
        )
        .toDecimalPlaces(2);

      const unpaidPeriods = allSchedule
        .filter((s) => s.status === "PENDING" || s.status === "PARTIAL")
        .sort((a, b) => a.periodNumber - b.periodNumber);

      const nextUnpaid = unpaidPeriods[0];
      const nextDue = nextUnpaid?.dueDate ?? account.nextDueDate;

      let status: "ACTIVE" | "FULLY_PAID" | "OVERDUE" | "DUE_TODAY" = "ACTIVE";

      if (newBalance.eq(0)) {
        status = "FULLY_PAID";
      } else if (nextUnpaid) {
        const todayStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(paymentDate);
        const dueStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(nextUnpaid.dueDate);

        if (todayStr > dueStr) {
          status = "OVERDUE";
        } else if (todayStr === dueStr) {
          status = "DUE_TODAY";
        }
      }

      await tx.installmentAccount.update({
        where: { id: body.installmentAccountId },
        data: {
          remainingBalance: decimalToString(newBalance),
          status,
          nextDueDate: nextDue,
        },
      });

      return createdPayment;
    }));

    return NextResponse.json({ payment: serializePayment(payment) }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
