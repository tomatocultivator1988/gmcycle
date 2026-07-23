import Decimal from "decimal.js";
import { NextResponse } from "next/server";
import { handleApiError, readJson } from "@/lib/api";
import { NotFoundError } from "@/lib/errors";
import { decimalToString } from "@/lib/money";
import { computeAccruedPenalty } from "@/lib/penalty";
import { recalculateBalance } from "@/lib/balance";
import { prisma } from "@/lib/prisma";
import { updateOverdueSchedule } from "@/lib/schedule-status";

export const runtime = "nodejs";

function parseAsOfDate(dateStr: string): Date {
  const parsed = new Date(dateStr + "T00:00:00.000+08:00");
  if (isNaN(parsed.getTime())) {
    throw new Error("Invalid asOfDate format");
  }
  return parsed;
}

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id: installmentAccountId } = await context.params;
    const body = await readJson(request) as { periodId: string; appliedAmount?: string; asOfDate?: string };

    if (!body.periodId) {
      return NextResponse.json({ error: "periodId is required" }, { status: 400 });
    }

    const period = await prisma.installmentSchedule.findUnique({
      where: { id: body.periodId },
    });

    if (!period) {
      throw new NotFoundError("Schedule period not found");
    }

    if (period.installmentAccountId !== installmentAccountId) {
      return NextResponse.json({ error: "Period does not belong to this account" }, { status: 400 });
    }

    if (period.status === "PAID") {
      return NextResponse.json({ error: "Cannot apply penalty to a paid period" }, { status: 400 });
    }

    const config = await prisma.adminConfig.findFirst();
    const penaltyPerDay = config?.penaltyPerDay
      ? new Decimal(config.penaltyPerDay.toString())
      : new Decimal("50.00");

    const referenceDate = body.asOfDate ? parseAsOfDate(body.asOfDate) : new Date();
    const { daysOverdue, accrued } = computeAccruedPenalty(period.dueDate, referenceDate, { penaltyPerDay });

    const appliedAmount = body.appliedAmount
      ? new Decimal(body.appliedAmount)
      : accrued;

    if (appliedAmount.lte(0)) {
      return NextResponse.json({ error: "Applied penalty must be greater than 0" }, { status: 400 });
    }

    const waivedAmount = accrued.gt(appliedAmount) ? accrued.minus(appliedAmount).toDecimalPlaces(2) : new Decimal(0);

    const result = await prisma.$transaction(async (tx) => {
      await updateOverdueSchedule(installmentAccountId);

      const existingPenalty = new Decimal(period.penaltyAmount);
      const totalPenalty = existingPenalty.plus(appliedAmount);

      await tx.installmentSchedule.update({
        where: { id: body.periodId },
        data: {
          penaltyAmount: decimalToString(totalPenalty),
        },
      });

      let reason = `Applied: ₱${appliedAmount.toFixed(2)} | Accrued: ₱${accrued.toFixed(2)} (${daysOverdue}d × ₱${penaltyPerDay.toFixed(2)}/day)`;
      if (waivedAmount.gt(0)) {
        reason += ` | Waived: ₱${waivedAmount.toFixed(2)}`;
      }

      const penaltyRecord = await tx.penaltyRecord.create({
        data: {
          installmentAccountId,
          installmentScheduleId: body.periodId,
          paymentId: period.paymentId || null,
          amount: decimalToString(appliedAmount),
          appliedDate: new Date(),
          reason,
        },
      });

      await recalculateBalance(tx, installmentAccountId);

      return { penaltyRecord };
    });

    return NextResponse.json({
      penaltyRecord: {
        ...result.penaltyRecord,
        amount: decimalToString(appliedAmount),
        appliedDate: result.penaltyRecord.appliedDate.toISOString(),
      },
      accrued: decimalToString(accrued),
      applied: decimalToString(appliedAmount),
      waived: decimalToString(waivedAmount),
      daysOverdue,
      message: `₱${appliedAmount.toFixed(2)} penalty applied to period #${period.periodNumber}${waivedAmount.gt(0) ? ` (₱${waivedAmount.toFixed(2)} waived)` : ""}`,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
