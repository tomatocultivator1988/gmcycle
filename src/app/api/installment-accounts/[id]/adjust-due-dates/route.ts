import { NextResponse } from "next/server";
import { handleApiError, readJson } from "@/lib/api";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { generateAdjustedDates } from "@/lib/installment-schedule";
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

    const account = await prisma.installmentAccount.findUnique({
      where: { id },
      select: { scheduleType: true },
    });

    if (!account) throw new NotFoundError("Account not found");

    if (account.scheduleType === "MONTHLY" && body.dueDays.length !== 1) {
      throw new ValidationError("Monthly schedule requires exactly 1 due day");
    }

    const allPeriods = await prisma.installmentSchedule.findMany({
      where: { installmentAccountId: id },
      orderBy: { periodNumber: "asc" },
    });

    if (allPeriods.length === 0) {
      return NextResponse.json({ message: "No periods found" });
    }

    const sortedDueDays = [...body.dueDays].sort((a, b) => a - b);
    const startDate = allPeriods[0].dueDate;
    const newDates = generateAdjustedDates(sortedDueDays, allPeriods.length, startDate);

    const updates = allPeriods.map((period, i) =>
      prisma.installmentSchedule.update({
        where: { id: period.id },
        data: { dueDate: newDates[i] },
      }),
    );

    await prisma.$transaction(updates);

    // nextDueDate = first unpaid period's new date, or last period if all paid
    const firstUnpaidIndex = allPeriods.findIndex(
      (p) => p.status === "PENDING" || p.status === "PARTIAL",
    );
    const nextDueDate = firstUnpaidIndex >= 0 ? newDates[firstUnpaidIndex] : newDates[newDates.length - 1];

    await prisma.installmentAccount.update({
      where: { id },
      data: {
        dueDays: sortedDueDays,
        nextDueDate,
      },
    });

    return NextResponse.json({ message: "Due dates adjusted for all periods", count: allPeriods.length, newFirstDueDate: newDates[0] });
  } catch (error) {
    return handleApiError(error);
  }
}
