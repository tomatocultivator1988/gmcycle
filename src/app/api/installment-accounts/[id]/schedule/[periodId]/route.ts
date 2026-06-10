import { NextResponse } from "next/server";
import { handleApiError, readJson } from "@/lib/api";
import { NotFoundError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string; periodId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id, periodId } = await context.params;
    const body = await readJson(request) as { dueDate: string };

    const period = await prisma.installmentSchedule.findUnique({
      where: { id: periodId },
    });

    if (!period || period.installmentAccountId !== id) {
      throw new NotFoundError("Schedule period not found");
    }

    if (period.status === "PAID") {
      return NextResponse.json(
        { error: "Cannot change due date of a paid period" },
        { status: 400 },
      );
    }

    const updated = await prisma.installmentSchedule.update({
      where: { id: periodId },
      data: { dueDate: new Date(body.dueDate) },
    });

    const nextPending = await prisma.installmentSchedule.findFirst({
      where: { installmentAccountId: id, status: { in: ["PENDING", "PARTIAL"] } },
      orderBy: { periodNumber: "asc" },
    });

    if (nextPending) {
      await prisma.installmentAccount.update({
        where: { id },
        data: { nextDueDate: nextPending.dueDate },
      });
    }

    return NextResponse.json({ schedule: updated });
  } catch (error) {
    return handleApiError(error);
  }
}
