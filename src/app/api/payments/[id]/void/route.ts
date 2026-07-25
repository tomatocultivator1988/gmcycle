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

    // Only the latest non-voided payment can be voided
    const latestPayment = await prisma.payment.findFirst({
      where: {
        installmentAccountId: payment.installmentAccountId,
        voided: false,
      },
      orderBy: [
        { paymentDate: "desc" },
        { createdAt: "desc" },
      ],
    });

    if (!latestPayment || latestPayment.id !== id) {
      return NextResponse.json(
        { error: "Only the latest payment can be voided. Voiding older payments would corrupt the account finances." },
        { status: 400 },
      );
    }

    await prisma.$transaction(async (tx) => {
      // 1. Find all schedule periods affected by this payment
      const affectedPeriods = await tx.installmentSchedule.findMany({
        where: { paymentId: id },
      });

      // 2. Read auto-penalty records linked to this payment (must reverse auto-applied penalty)
      const autoPenaltyRecords = await tx.penaltyRecord.findMany({
        where: { paymentId: id },
        select: { installmentScheduleId: true, amount: true },
      });
      const autoPenaltyByPeriod = new Map<string, Decimal>();
      for (const r of autoPenaltyRecords) {
        if (!r.installmentScheduleId) continue;
        const prev = autoPenaltyByPeriod.get(r.installmentScheduleId) || new Decimal(0);
        autoPenaltyByPeriod.set(r.installmentScheduleId, prev.plus(new Decimal(r.amount.toString())));
      }

      // 3. Restore penaltyAmount and paidAmount on each period using per-period breakdowns
      const penaltyBreakdown = payment.penaltyBreakdown as Record<string, string> | null;
      const principalBreakdown = payment.principalBreakdown as Record<string, string> | null;
      const paymentPenalty = new Decimal(payment.penaltyAmount);
      const numPeriods = affectedPeriods.length;

      const resetPromises = affectedPeriods.map((period) => {
        const currentPenalty = new Decimal(period.penaltyAmount);
        const periodPenaltyCovered = penaltyBreakdown?.[period.id]
          ? new Decimal(penaltyBreakdown[period.id])
          : numPeriods > 0 ? paymentPenalty.div(numPeriods) : paymentPenalty;
        const autoPenalty = autoPenaltyByPeriod.get(period.id) || new Decimal(0);
        const restored = currentPenalty.plus(periodPenaltyCovered).minus(autoPenalty);

        const currentPaidAmount = period.paidAmount
          ? new Decimal(period.paidAmount)
          : new Decimal(0);
        const thisPaymentPrincipal = principalBreakdown?.[period.id]
          ? new Decimal(principalBreakdown[period.id])
          : new Decimal(0);
        const newPaidAmount = Decimal.max(0, currentPaidAmount.minus(thisPaymentPrincipal));

        const newStatus = newPaidAmount.gt(0) ? "PARTIAL" : "PENDING";

        return tx.installmentSchedule.update({
          where: { id: period.id },
          data: {
            status: newStatus as any,
            paidDate: newPaidAmount.gt(0) ? period.paidDate : null,
            paymentId: newPaidAmount.gt(0) ? period.paymentId : null,
            paidAmount: newPaidAmount.gt(0) ? decimalToString(newPaidAmount) : null,
            penaltyAmount: decimalToString(
              restored.isNegative() ? new Decimal(0) : restored,
            ),
          },
        });
      });
      await Promise.all(resetPromises);

      // 4. Delete penalty records linked to this payment
      await tx.penaltyRecord.deleteMany({ where: { paymentId: id } });

      // 5. Mark payment as voided
      await tx.payment.update({
        where: { id },
        data: {
          voided: true,
          voidedAt: new Date(),
          voidReason: body.reason || null,
        },
      });

      // 6. Recalculate balance and status using shared function
      await recalculateBalance(tx, payment.installmentAccountId);

      // 7. Activity log
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
