import { NextResponse } from "next/server";
import { handleApiError, readJson } from "@/lib/api";
import { NotFoundError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { serializeInstallmentAccount } from "@/lib/serializers";
import { markBadRecordSchema } from "@/lib/validation";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = markBadRecordSchema.parse(await readJson(request));

    const existing = await prisma.installmentAccount.findUnique({ where: { id } });

    if (!existing) {
      throw new NotFoundError("Installment account not found");
    }

    const updated = await prisma.installmentAccount.update({
      where: { id },
      data: {
        badRecord: body.badRecord,
        badRecordRemark: body.badRecord ? body.badRecordRemark || null : null,
      },
    });

    return NextResponse.json({
      installmentAccount: serializeInstallmentAccount(updated),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
