import Decimal from "decimal.js";
import { NextResponse } from "next/server";
import { handleApiError, readJson } from "@/lib/api";
import { recalculateBalance } from "@/lib/balance";
import { NotFoundError } from "@/lib/errors";
import { decimalToString } from "@/lib/money";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await readJson(request) as { reason: string };

    const payment = await prisma.payment.findUnique({
      where: { id },
      include: { installmentAccount: true },
    });

    if (!payment) throw new NotFoundError("Payment not found");
    if (payment.voided) throw new NotFoundError("Payment already voided");

    await prisma.$transaction(async (tx) => {
      // 1. Find all schedule periods affected by this payment
      const affectedPeriods = await tx.installmentSchedule.findMany({
        where: { paymentId: id },
      });

      // 2. For each affected period, find previous payment state
      for (const period of affectedPeriods) {
        // Restore period to PENDING state (balance recalc will fix totals)
        const restoreStatus: "PENDING" = "PENDING";

        await tx.installmentSchedule.update({
          where: { id: period.id },
          data: {
            status: restoreStatus,
            paidDate: null,
            paymentId: null,
            paidAmount: null,
          },
        });
      }

      // 3. Delete penalty records linked to this payment
      await tx.penaltyRecord.deleteMany({ where: { paymentId: id } });

      // 4. Mark payment as voided
      await tx.payment.update({
        where: { id },
        data: {
          voided: true,
          voidedAt: new Date(),
          voidReason: body.reason || null,
        },
      });

      // 5. Recalculate balance and status using shared function
      await recalculateBalance(tx, payment.installmentAccountId);

      // 6. Activity log
      await tx.activityLog.create({
        data: {
          accountId: payment.installmentAccountId,
          action: "VOID_PAYMENT",
          details: `Voided payment ₱${new Decimal(payment.totalAmount.toString()).toFixed(2)} — ${body.reason || "No reason provided"}`,
          paymentId: id,
        },
      });
    });

    return NextResponse.json({ message: "Payment voided successfully" });
  } catch (error) {
    return handleApiError(error);
  }
}
