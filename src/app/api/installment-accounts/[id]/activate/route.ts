import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api";
import { NotFoundError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { serializeInstallmentAccount } from "@/lib/serializers";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;

    const account = await prisma.installmentAccount.findUnique({ where: { id } });

    if (!account) {
      throw new NotFoundError("Installment account not found");
    }

    if (account.status !== "APPLIED") {
      return NextResponse.json(
        { error: "Only APPLIED accounts can be activated" },
        { status: 400 },
      );
    }

    const updated = await prisma.installmentAccount.update({
      where: { id },
      data: { status: "ACTIVE" },
    });

    return NextResponse.json({ installmentAccount: serializeInstallmentAccount(updated) });
  } catch (error) {
    return handleApiError(error);
  }
}
