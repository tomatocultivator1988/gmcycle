import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { serializeInstallmentSchedule } from "@/lib/serializers";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const schedule = await prisma.installmentSchedule.findMany({
      where: { installmentAccountId: id },
      orderBy: { periodNumber: "asc" },
    });

    return NextResponse.json({
      schedule: schedule.map(serializeInstallmentSchedule),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
