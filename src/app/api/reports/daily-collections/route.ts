import Decimal from "decimal.js";
import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api";
import { getManilaDayRange, dateToManilaDateOnly, parseDateOnly } from "@/lib/dates";
import { decimalToString } from "@/lib/money";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get("date");
    const { start, end } = dateParam
      ? (() => { const d = parseDateOnly(dateParam); return { start: d, end: new Date(d.getTime() + 24 * 60 * 60 * 1000) }; })()
      : getManilaDayRange();
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 50));

    const [payments, totalCount, grandTotalResult] = await Promise.all([
      prisma.payment.findMany({
        where: { paymentDate: { gte: start, lt: end }, voided: false },
        orderBy: { paymentDate: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          installmentAccount: { select: { id: true, brand: true, model: true, customerName: true } },
        },
      }),
      prisma.payment.count({ where: { paymentDate: { gte: start, lt: end }, voided: false } }),
      prisma.payment.aggregate({
        where: { paymentDate: { gte: start, lt: end }, voided: false },
        _sum: { totalAmount: true },
      }),
    ]);

    const total = payments.reduce(
      (sum, p) => sum.plus(new Decimal(p.totalAmount.toString())),
      new Decimal(0),
    );

    const grandTotal = new Decimal(grandTotalResult._sum.totalAmount?.toString() ?? "0");

    return NextResponse.json({
      date: dateToManilaDateOnly(start),
      collections: payments.map((p) => ({
        id: p.id,
        accountId: p.installmentAccount.id,
        customerName: p.installmentAccount.customerName,
        unit: `${p.installmentAccount.brand} ${p.installmentAccount.model}`,
        amount: decimalToString(p.totalAmount),
        method: p.method,
        paymentType: p.paymentType,
        cashier: p.cashier,
      })),
      total: decimalToString(total),
      grandTotal: decimalToString(grandTotal),
      pagination: { page, limit, total: totalCount, totalPages: Math.ceil(totalCount / limit) },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
