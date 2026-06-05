import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { serializePenaltyRecord } from "@/lib/serializers";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const penalties = await prisma.penaltyRecord.findMany({
      where: { installmentAccountId: id },
      orderBy: { appliedDate: "desc" },
    });

    return NextResponse.json({
      penalties: penalties.map(serializePenaltyRecord),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
