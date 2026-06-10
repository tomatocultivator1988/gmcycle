import Decimal from "decimal.js";
import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api";
import { getManilaDayRange, dateToManilaDateOnly } from "@/lib/dates";
import { decimalToString } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { startOfMonth, endOfMonth, startOfYear, format } from "date-fns";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { start: today } = getManilaDayRange();
    const monthStart = startOfMonth(today);
    const monthEnd = endOfMonth(today);
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 50));

    const [payments, totalCount] = await Promise.all([
      prisma.payment.findMany({
        where: { paymentDate: { gte: monthStart, lt: monthEnd }, voided: false },
        orderBy: { paymentDate: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.payment.count({ where: { paymentDate: { gte: monthStart, lt: monthEnd }, voided: false } }),
    ]);

    const monthlyTotal = payments.reduce(
      (sum, p) => sum.plus(new Decimal(p.totalAmount.toString())),
      new Decimal(0),
    );

    const yearStart = startOfYear(today);
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

    return NextResponse.json({
      month: dateToManilaDateOnly(monthStart).slice(0, 7),
      total: decimalToString(monthlyTotal),
      count: totalCount,
      monthlyBreakdown,
      pagination: { page, limit, total: totalCount, totalPages: Math.ceil(totalCount / limit) },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
