import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { serializePayment } from "@/lib/serializers";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const payments = await prisma.payment.findMany({
      where: { installmentAccountId: id },
      orderBy: { paymentDate: "desc" },
    });

    return NextResponse.json({
      payments: payments.map(serializePayment),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
