import Decimal from "decimal.js";
import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api";
import { getManilaDayRange, dateToManilaDateOnly } from "@/lib/dates";
import { decimalToString } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import {
  startOfMonth,
  endOfMonth,
  startOfYear,
  eachMonthOfInterval,
  format,
} from "date-fns";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { start: today } = getManilaDayRange();
    const monthStart = startOfMonth(today);
    const monthEnd = endOfMonth(today);

    const payments = await prisma.payment.findMany({
      where: { paymentDate: { gte: monthStart, lt: monthEnd } },
      orderBy: { paymentDate: "desc" },
    });

    const monthlyTotal = payments.reduce(
      (sum, p) => sum.plus(new Decimal(p.totalAmount.toString())),
      new Decimal(0),
    );

    const yearStart = startOfYear(today);
    const months = eachMonthOfInterval({ start: yearStart, end: today });
    const monthlyBreakdown: { month: string; total: string; count: number }[] = [];

    for (const m of months) {
      const ms = startOfMonth(m);
      const me = endOfMonth(m);
      const monthPayments = await prisma.payment.findMany({
        where: { paymentDate: { gte: ms, lt: me } },
      });

      const monthTotal = monthPayments.reduce(
        (sum, p) => sum.plus(new Decimal(p.totalAmount.toString())),
        new Decimal(0),
      );

      monthlyBreakdown.push({
        month: format(m, "yyyy-MM"),
        total: decimalToString(monthTotal),
        count: monthPayments.length,
      });
    }

    return NextResponse.json({
      month: dateToManilaDateOnly(monthStart).slice(0, 7),
      total: decimalToString(monthlyTotal),
      count: payments.length,
      monthlyBreakdown,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
