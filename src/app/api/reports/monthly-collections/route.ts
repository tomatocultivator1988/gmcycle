import Decimal from "decimal.js";
import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api";
import { getManilaDayRange, dateToManilaDateOnly, parseDateOnly } from "@/lib/dates";
import { decimalToString } from "@/lib/money";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function getMonthRange(date: Date): { start: Date; end: Date } {
  const start = new Date(`${dateToManilaDateOnly(date).slice(0, 7)}-01T00:00:00.000+08:00`);
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);
  return { start, end };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const monthParam = searchParams.get("month");
    const referenceDate = monthParam
      ? parseDateOnly(monthParam + "-01")
      : getManilaDayRange().start;
    const { start: monthStart, end: monthEnd } = getMonthRange(referenceDate);
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 50));

    const [payments, totalCount] = await Promise.all([
      prisma.payment.findMany({
        where: { paymentDate: { gte: monthStart, lt: monthEnd }, voided: false },
        orderBy: { paymentDate: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          installmentAccount: { select: { id: true, brand: true, model: true, customerName: true } },
        },
      }),
      prisma.payment.count({ where: { paymentDate: { gte: monthStart, lt: monthEnd }, voided: false } }),
    ]);

    const monthlyTotal = payments.reduce(
      (sum, p) => sum.plus(new Decimal(p.totalAmount.toString())),
      new Decimal(0),
    );

    const yearStart = new Date(`${dateToManilaDateOnly(referenceDate).slice(0, 4)}-01-01T00:00:00.000+08:00`);
    const breakdown = await prisma.$queryRawUnsafe<Array<{
      month: string;
      total: string;
      count: number;
    }>>(
      `SELECT
        TO_CHAR(DATE_TRUNC('month', "paymentDate"), 'YYYY-MM') AS month,
        COALESCE(SUM("totalAmount"), 0)::text AS total,
        COUNT(*)::int AS count
      FROM "Payment"
      WHERE "paymentDate" >= $1::timestamp
        AND "paymentDate" < $2::timestamp
        AND "voided" = false
      GROUP BY DATE_TRUNC('month', "paymentDate")
      ORDER BY month`,
      yearStart,
      monthEnd,
    );

    const monthlyBreakdown = breakdown.map((r) => ({
      month: r.month,
      total: r.total,
      count: Number(r.count),
    }));

    const collections = payments.map((p) => ({
      id: p.id,
      accountId: p.installmentAccount.id,
      customerName: p.installmentAccount.customerName,
      unit: `${p.installmentAccount.brand} ${p.installmentAccount.model}`,
      amount: decimalToString(p.totalAmount),
      paymentDate: dateToManilaDateOnly(p.paymentDate),
      method: p.method,
      paymentType: p.paymentType,
      cashier: p.cashier,
    }));

    return NextResponse.json({
      month: dateToManilaDateOnly(monthStart).slice(0, 7),
      total: decimalToString(monthlyTotal),
      count: totalCount,
      collections,
      monthlyBreakdown,
      pagination: { page, limit, total: totalCount, totalPages: Math.ceil(totalCount / limit) },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
