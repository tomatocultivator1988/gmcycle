import { NextResponse } from "next/server";
import Decimal from "decimal.js";
import { handleApiError, readJson } from "@/lib/api";
import { NotFoundError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { serializeInstallmentAccount } from "@/lib/serializers";
import { closeAccountSchema } from "@/lib/validation";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = closeAccountSchema.parse(await readJson(request));

    const existing = await prisma.installmentAccount.findUnique({ where: { id } });

    if (!existing) {
      throw new NotFoundError("Installment account not found");
    }

    if (existing.status === "CLOSED") {
      return NextResponse.json(
        { error: "Account is already closed" },
        { status: 400 },
      );
    }

    const balance = new Decimal(existing.remainingBalance.toString());
    if (balance.gt(0)) {
      return NextResponse.json(
        { error: `Cannot close account with outstanding balance of ₱${balance.toFixed(2)}` },
        { status: 400 },
      );
    }

    const updated = await prisma.installmentAccount.update({
      where: { id },
      data: {
        status: "CLOSED",
        remarks: body.remarks,
      },
    });

    return NextResponse.json({
      installmentAccount: serializeInstallmentAccount(updated),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
