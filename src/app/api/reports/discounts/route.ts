import Decimal from "decimal.js";
import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api";
import { decimalToString } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { dateToManilaDateOnly } from "@/lib/dates";

export const runtime = "nodejs";

export async function GET() {
  try {
    const discounts = await prisma.discountRecord.findMany({
      orderBy: { appliedDate: "desc" },
      include: {
        installmentAccount: { select: { brand: true, model: true, customerName: true } },
      },
    });

    const total = discounts.reduce(
      (sum, p) => sum.plus(new Decimal(p.amount.toString())),
      new Decimal(0),
    );

    return NextResponse.json({
      discounts: discounts.map((p) => ({
        id: p.id,
        customerName: p.installmentAccount.customerName,
        unit: `${p.installmentAccount.brand} ${p.installmentAccount.model}`,
        amount: decimalToString(p.amount),
        appliedDate: dateToManilaDateOnly(p.appliedDate),
        reason: p.reason,
      })),
      total: decimalToString(total),
      count: discounts.length,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
