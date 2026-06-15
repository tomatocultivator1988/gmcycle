import { NextResponse } from "next/server";
import Decimal from "decimal.js";
import { handleApiError, readJson } from "@/lib/api";
import { NotFoundError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { serializeInstallmentAccount } from "@/lib/serializers";
import { closeAccountSchema } from "@/lib/validation";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

async function getAdminPassword(): Promise<string> {
  const config = await prisma.adminConfig.findFirst();
  return config?.adminPassword || "buratnianjo123";
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = closeAccountSchema.parse(await readJson(request));

    const existing = await prisma.installmentAccount.findUnique({
      where: { id },
      include: { schedule: { where: { status: "PAID" } } },
    });

    if (!existing) {
      throw new NotFoundError("Installment account not found");
    }

    if (existing.status === "CLOSED") {
      return NextResponse.json(
        { error: "Account is already closed" },
        { status: 400 },
      );
    }

    const adminPassword = await getAdminPassword();
    if (body.password !== adminPassword) {
      return NextResponse.json(
        { error: "Incorrect admin password" },
        { status: 401 },
      );
    }

    const balance = new Decimal(existing.remainingBalance.toString());
    const paidPeriods = existing.schedule.length;
    const totalPaid = existing.schedule.length > 0 ? `${paidPeriods} schedules paid` : "";

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.installmentAccount.update({
        where: { id },
        data: {
          status: "CLOSED",
          remainingBalance: new Decimal("0.00"),
          remarks: body.remarks
            ? `${body.remarks} | Written off: ₱${balance.toFixed(2)}`
            : `Written off: ₱${balance.toFixed(2)}`,
        },
      });

      await tx.activityLog.create({
        data: {
          accountId: id,
          action: "CLOSED",
          details: `Account closed. ₱${balance.toFixed(2)} written off. ${totalPaid}`,
        },
      });

      return result;
    });

    return NextResponse.json({
      installmentAccount: serializeInstallmentAccount(updated),
      writtenOff: balance.gt(0) ? balance.toFixed(2) : "0.00",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
