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

    const hadScheduleLink = !!penaltyRecord.installmentScheduleId;
    let period = penaltyRecord.installmentSchedule;

    if (!period) {
      const periodMatch = penaltyRecord.reason?.match(/period\s*#(\d+)/i);
      if (periodMatch) {
        const targetNumber = parseInt(periodMatch[1], 10);
        period = await prisma.installmentSchedule.findFirst({
          where: {
            installmentAccountId: penaltyRecord.installmentAccountId,
            periodNumber: targetNumber,
          },
        });
      }

      if (!period) {
        return NextResponse.json(
          { error: "Cannot undo penalty — could not find the associated schedule period" },
          { status: 400 },
        );
      }
    }

    const penaltyAmount = new Decimal(penaltyRecord.amount);

    if (hadScheduleLink) {
      if (new Decimal(period.penaltyAmount).lt(penaltyAmount)) {
        return NextResponse.json(
          { error: "Cannot undo — this penalty has already been partially or fully paid" },
          { status: 400 },
        );
      }

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
    }

    await prisma.$transaction(async (tx) => {
      if (hadScheduleLink) {
        const currentPenalty = new Decimal(period.penaltyAmount);
        const newPenalty = Decimal.max(0, currentPenalty.minus(penaltyAmount));

        await tx.installmentSchedule.update({
          where: { id: period.id },
          data: {
            penaltyAmount: decimalToString(newPenalty),
          },
        });
      }

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
