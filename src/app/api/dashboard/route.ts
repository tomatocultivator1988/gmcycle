import Decimal from "decimal.js";
import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api";
import { getManilaDayRange } from "@/lib/dates";
import { decimalToString } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { start: todayStart, end: todayEnd } = getManilaDayRange();
    const weekStart = startOfWeek(todayStart, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(todayEnd, { weekStartsOn: 1 });
    const monthStart = startOfMonth(todayStart);
    const monthEnd = endOfMonth(todayEnd);

    // ── 1. Status counts (single query via groupBy) ──
    const statusCounts = await prisma.installmentAccount.groupBy({
      by: ["status"],
      _count: true,
    });

    const countMap: Record<string, number> = {};
    for (const row of statusCounts) {
      countMap[row.status] = row._count;
    }
    const totalAccounts = Object.values(countMap).reduce((a, b) => a + b, 0);
    const appliedAccounts = countMap.APPLIED ?? 0;
    const activeAccounts = countMap.ACTIVE ?? 0;
    const fullyPaidAccounts = countMap.FULLY_PAID ?? 0;
    const overdueAccounts = countMap.OVERDUE ?? 0;
    const dueTodayAccounts = countMap.DUE_TODAY ?? 0;
    const currentAccounts = (countMap.ACTIVE ?? 0) + (countMap.DUE_TODAY ?? 0);

    // ── 2. Account financial aggregates (single raw query) ──
    const [accountAggs] = await prisma.$queryRawUnsafe<Array<{
      total_installment: string;
      total_down: string;
      total_outstanding: string;
      total_cash: string;
      total_installment_price: string;
    }>>(`
      SELECT
        COALESCE(SUM("installmentPrice"), 0)::text AS "total_installment",
        COALESCE(SUM("downPayment"), 0)::text AS "total_down",
        COALESCE(SUM(CASE WHEN status IN ('ACTIVE','OVERDUE','DUE_TODAY') THEN "remainingBalance" ELSE 0 END), 0)::text AS "total_outstanding",
        COALESCE(SUM("cashPrice"), 0)::text AS "total_cash",
        COALESCE(SUM("installmentPrice"), 0)::text AS "total_installment_price"
      FROM "InstallmentAccount"
    `);

    const totalCashPrice = new Decimal(accountAggs.total_cash);
    const totalInstallmentPrice = new Decimal(accountAggs.total_installment_price);
    const totalInstallmentMargin = totalInstallmentPrice.sub(totalCashPrice);

    // ── 3. Payment aggregates (single raw query) ──
    const [paymentAggs] = await prisma.$queryRawUnsafe<Array<{
      total_collections: string;
      total_penalties: string;
      today: string;
      week: string;
      month: string;
    }>>(
      `SELECT
        COALESCE(SUM("totalAmount"), 0)::text AS "total_collections",
        COALESCE(SUM("penaltyAmount"), 0)::text AS "total_penalties",
        COALESCE(SUM(CASE WHEN "paymentDate" >= $1::timestamp AND "paymentDate" < $2::timestamp THEN "totalAmount" ELSE 0 END), 0)::text AS "today",
        COALESCE(SUM(CASE WHEN "paymentDate" >= $3::timestamp AND "paymentDate" < $4::timestamp THEN "totalAmount" ELSE 0 END), 0)::text AS "week",
        COALESCE(SUM(CASE WHEN "paymentDate" >= $5::timestamp AND "paymentDate" < $6::timestamp THEN "totalAmount" ELSE 0 END), 0)::text AS "month"
      FROM "Payment"`,
      todayStart, todayEnd, weekStart, weekEnd, monthStart, monthEnd,
    );

    // ── 4. Aging: overdue list (single query) ──
    const overdueList = await prisma.installmentAccount.findMany({
      where: { status: "OVERDUE" },
      select: { nextDueDate: true },
    });

    const today = todayStart;
    let days1to30 = 0;
    let days31to60 = 0;
    let days61to90 = 0;
    let days90plus = 0;

    for (const acc of overdueList) {
      const diffDays = Math.floor((today.getTime() - acc.nextDueDate.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays <= 30) days1to30++;
      else if (diffDays <= 60) days31to60++;
      else if (diffDays <= 90) days61to90++;
      else days90plus++;
    }

    return NextResponse.json({
      metrics: {
        totalAccounts,
        appliedAccounts,
        activeAccounts,
        fullyPaidAccounts,
        overdueAccounts,
        dueTodayAccounts,
        totalInstallmentSales: decimalToString(totalInstallmentPrice.toString()),
        totalInstallmentMargin: decimalToString(totalInstallmentMargin.toString()),
        totalDownPayments: decimalToString(accountAggs.total_down),
        totalCollections: decimalToString(paymentAggs.total_collections),
        outstandingBalances: decimalToString(accountAggs.total_outstanding),
        totalPenaltiesCollected: decimalToString(paymentAggs.total_penalties),
        collectionsToday: decimalToString(paymentAggs.today),
        collectionsThisWeek: decimalToString(paymentAggs.week),
        collectionsThisMonth: decimalToString(paymentAggs.month),
        aging: {
          current: currentAccounts,
          days1to30,
          days31to60,
          days61to90,
          days90plus,
        },
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
