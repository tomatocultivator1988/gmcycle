import Decimal from "decimal.js";
import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api";
import { recalculateBalance } from "@/lib/balance";
import { NotFoundError } from "@/lib/errors";
import { decimalToString } from "@/lib/money";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;

    const penaltyRecord = await prisma.penaltyRecord.findUnique({
      where: { id },
      include: {
        installmentSchedule: true,
        installmentAccount: true,
      },
    });

    if (!penaltyRecord) {
      throw new NotFoundError("Penalty record not found");
    }

    if (penaltyRecord.installmentAccount.status === "FULLY_PAID") {
      return NextResponse.json(
        { error: "Cannot undo penalty on a fully paid account" },
        { status: 400 },
      );
    }

    if (!penaltyRecord.installmentScheduleId || !penaltyRecord.installmentSchedule) {
      return NextResponse.json(
        { error: "Cannot undo penalty — linked schedule period not found" },
        { status: 400 },
      );
    }

    const period = penaltyRecord.installmentSchedule;
    const penaltyAmount = new Decimal(penaltyRecord.amount);

    // Find the latest PenaltyRecord for this period — only allow undo on the latest
    const latestForPeriod = await prisma.penaltyRecord.findFirst({
      where: { installmentScheduleId: period.id },
      orderBy: { appliedDate: "desc" },
    });

    if (!latestForPeriod || latestForPeriod.id !== id) {
      return NextResponse.json(
        { error: "Only the latest penalty on this period can be undone" },
        { status: 400 },
      );
    }

    await prisma.$transaction(async (tx) => {
      const currentPenalty = new Decimal(period.penaltyAmount);
      const newPenalty = Decimal.max(0, currentPenalty.minus(penaltyAmount));

      await tx.installmentSchedule.update({
        where: { id: period.id },
        data: {
          penaltyAmount: decimalToString(newPenalty),
        },
      });

      await tx.penaltyRecord.delete({
        where: { id },
      });

      await recalculateBalance(tx, penaltyRecord.installmentAccountId);
    });

    return NextResponse.json({
      message: `₱${penaltyAmount.toFixed(2)} penalty undone for period #${period.periodNumber}`,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
