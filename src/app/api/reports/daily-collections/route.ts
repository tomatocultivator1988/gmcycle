import Decimal from "decimal.js";
import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api";
import { getManilaDayRange, dateToManilaDateOnly } from "@/lib/dates";
import { decimalToString } from "@/lib/money";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { start, end } = getManilaDayRange();
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 50));

    const [payments, totalCount] = await Promise.all([
      prisma.payment.findMany({
        where: { paymentDate: { gte: start, lt: end }, voided: false },
        orderBy: { paymentDate: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          installmentAccount: { select: { brand: true, model: true, customerName: true } },
        },
      }),
      prisma.payment.count({ where: { paymentDate: { gte: start, lt: end } } }),
    ]);

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
      pagination: { page, limit, total: totalCount, totalPages: Math.ceil(totalCount / limit) },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
