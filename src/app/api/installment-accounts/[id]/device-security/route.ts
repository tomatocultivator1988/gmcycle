import { NextResponse } from "next/server";
import { handleApiError, readJson } from "@/lib/api";
import { NotFoundError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { serializeInstallmentAccount } from "@/lib/serializers";
import { deviceSecuritySchema } from "@/lib/validation";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = deviceSecuritySchema.parse(await readJson(request));

    const existing = await prisma.installmentAccount.findUnique({ where: { id } });

    if (!existing) {
      throw new NotFoundError("Installment account not found");
    }

    const updated = await prisma.installmentAccount.update({
      where: { id },
      data: {
        deviceEmail: body.deviceEmail,
        deviceEmailPassword: body.deviceEmailPassword,
        deviceAccountHolderEmail: body.deviceAccountHolderEmail,
      },
    });

    return NextResponse.json({
      installmentAccount: serializeInstallmentAccount(updated),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
