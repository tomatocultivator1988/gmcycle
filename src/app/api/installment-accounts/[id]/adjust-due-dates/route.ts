import { NextResponse } from "next/server";
import { handleApiError, readJson } from "@/lib/api";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { generateAdjustedDates } from "@/lib/installment-schedule";
import { updateOverdueSchedule } from "@/lib/schedule-status";
import { recalculateBalance } from "@/lib/balance";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await readJson(request) as { dueDays?: number[] };

    if (!body.dueDays || body.dueDays.length === 0) {
      throw new ValidationError("dueDays array is required");
    }

    for (const d of body.dueDays) {
      if (d < 1 || d > 31) {
        throw new ValidationError("Each due day must be between 1 and 31");
      }
    }

    if (body.dueDays.length > 1) {
      const sorted = [...body.dueDays].sort((a, b) => a - b);
      if (sorted[0] === sorted[1]) {
        throw new ValidationError("Due days must be distinct");
      }
    }

    const account = await prisma.installmentAccount.findUnique({
      where: { id },
      select: { scheduleType: true },
    });

    if (!account) throw new NotFoundError("Account not found");

    if (account.scheduleType === "MONTHLY" && body.dueDays.length !== 1) {
      throw new ValidationError("Monthly schedule requires exactly 1 due day");
    }

    // Reset stale OVERDUE status before adjusting dates
    await prisma.installmentSchedule.updateMany({
      where: {
        installmentAccountId: id,
        status: "OVERDUE",
      },
      data: { status: "PENDING" },
    });

    const allPeriods = await prisma.installmentSchedule.findMany({
      where: { installmentAccountId: id },
      orderBy: { periodNumber: "asc" },
    });

    if (allPeriods.length === 0) {
      return NextResponse.json({ message: "No periods found" });
    }

    // Only adjust PENDING + OVERDUE — PAID and PARTIAL are locked as historical records
    const adjustable = allPeriods.filter(
      (p) => p.status === "PENDING" || p.status === "OVERDUE",
    );

    if (adjustable.length === 0) {
      return NextResponse.json({ message: "No adjustable periods — all periods are either PAID or PARTIAL" });
    }

    const sortedDueDays = [...body.dueDays].sort((a, b) => a - b);
    const startDate = adjustable[0].dueDate;
    const newDates = generateAdjustedDates(sortedDueDays, adjustable.length, startDate);

    const updates = adjustable.map((period, i) =>
      prisma.installmentSchedule.update({
        where: { id: period.id },
        data: { dueDate: newDates[i] },
      }),
    );

    await prisma.$transaction(updates);

    await prisma.installmentAccount.update({
      where: { id },
      data: { dueDays: sortedDueDays },
    });

    // Recalculate statuses and balance
    await updateOverdueSchedule(id);
    await prisma.$transaction(async (tx) => {
      await recalculateBalance(tx, id);
    });

    return NextResponse.json({
      message: "Due dates adjusted for adjustable periods",
      count: adjustable.length,
      totalPeriods: allPeriods.length,
      newFirstDueDate: newDates[0],
    });
  } catch (error) {
    return handleApiError(error);
  }
}
