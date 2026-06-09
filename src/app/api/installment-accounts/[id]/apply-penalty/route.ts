import Decimal from "decimal.js";
import { NextResponse } from "next/server";
import { handleApiError, readJson } from "@/lib/api";
import { NotFoundError } from "@/lib/errors";
import { decimalToString } from "@/lib/money";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id: installmentAccountId } = await context.params;
    const body = await readJson(request) as { periodId: string; amount?: string; reason?: string };

    if (!body.periodId) {
      return NextResponse.json({ error: "periodId is required" }, { status: 400 });
    }

    const config = await prisma.adminConfig.findFirst();
    const configPenalty = config?.penaltyAmount ?? new Decimal("200.00");
    const penaltyAmount = body.amount
      ? new Decimal(body.amount)
      : configPenalty;

    if (penaltyAmount.lte(0)) {
      return NextResponse.json({ error: "Penalty amount must be greater than 0" }, { status: 400 });
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

    const result = await prisma.$transaction(async (tx) => {
      const updatedPeriod = await tx.installmentSchedule.update({
        where: { id: body.periodId },
        data: {
          penaltyAmount: decimalToString(penaltyAmount),
        },
      });

      const penaltyRecord = await tx.penaltyRecord.create({
        data: {
          installmentAccountId,
          paymentId: period.paymentId ?? "",
          amount: decimalToString(penaltyAmount),
          appliedDate: new Date(),
          reason: body.reason ?? `Manual penalty applied — period #${period.periodNumber}`,
        },
      });

      const accountSchedule = await tx.installmentSchedule.findMany({
        where: { installmentAccountId },
      });

      const newBalance = accountSchedule
        .filter((s) => s.status === "PENDING" || s.status === "PARTIAL")
        .reduce(
          (sum, s) => sum.plus(new Decimal(s.amount)).plus(new Decimal(s.penaltyAmount)),
          new Decimal(0),
        )
        .toDecimalPlaces(2);

      await tx.installmentAccount.update({
        where: { id: installmentAccountId },
        data: {
          remainingBalance: decimalToString(newBalance),
        },
      });

      return { period: updatedPeriod, penaltyRecord };
    });

    return NextResponse.json({
      penaltyRecord: {
        ...result.penaltyRecord,
        amount: decimalToString(penaltyAmount),
        appliedDate: result.penaltyRecord.appliedDate.toISOString(),
      },
      message: `Penalty of ₱${penaltyAmount.toFixed(2)} applied to period #${period.periodNumber}`,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
