import { NextResponse } from "next/server";
import { handleApiError, readJson } from "@/lib/api";
import { NotFoundError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { updateOverdueSchedule } from "@/lib/schedule-status";
import { serializeInstallmentAccount } from "@/lib/serializers";
import { updateInstallmentAccountSchema } from "@/lib/validation";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const account = await prisma.installmentAccount.findUnique({
      where: { id },
    });

    if (!account) {
      throw new NotFoundError("Installment account not found");
    }

    await updateOverdueSchedule(id);

    return NextResponse.json({
      installmentAccount: serializeInstallmentAccount(account),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = updateInstallmentAccountSchema.parse(await readJson(request));

    const existing = await prisma.installmentAccount.findUnique({ where: { id } });

    if (!existing) {
      throw new NotFoundError("Installment account not found");
    }

    const updateData: Record<string, unknown> = {
      customerName: body.customerName,
      customerPhone: body.customerPhone,
      customerEmail: body.customerEmail ?? null,
      customerAddress: body.customerAddress,
      brand: body.brand,
      model: body.model,
      unitDescription: body.unitDescription,
    };

    if (body.itemType !== undefined) {
      updateData.itemType = body.itemType;
    }
    if (body.processingFee !== undefined) {
      updateData.processingFee = body.processingFee?.trim() || "0.00";
    }
    if (body.customFields !== undefined) {
      updateData.customFields = body.customFields;
    }

    const updated = await prisma.installmentAccount.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      installmentAccount: serializeInstallmentAccount(updated),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
