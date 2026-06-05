import Decimal from "decimal.js";
import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api";
import { getManilaDayRange, dateToManilaDateOnly } from "@/lib/dates";
import { decimalToString } from "@/lib/money";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { start, end } = getManilaDayRange();
    const payments = await prisma.payment.findMany({
      where: { paymentDate: { gte: start, lt: end } },
      orderBy: { paymentDate: "desc" },
      include: {
        installmentAccount: { select: { brand: true, model: true, customerName: true } },
      },
    });

    const total = payments.reduce(
      (sum, p) => sum.plus(new Decimal(p.totalAmount.toString())),
      new Decimal(0),
    );

    return NextResponse.json({
      date: dateToManilaDateOnly(start),
      collections: payments.map((p) => ({
        id: p.id,
        customerName: p.installmentAccount.customerName,
        unit: `${p.installmentAccount.brand} ${p.installmentAccount.model}`,
        amount: decimalToString(p.totalAmount),
        method: p.method,
        cashier: p.cashier,
      })),
      total: decimalToString(total),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
