import { NextResponse } from "next/server";
import Decimal from "decimal.js";
import { handleApiError } from "@/lib/api";
import { decimalToString } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";

export const runtime = "nodejs";

export async function GET() {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 86400000);
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    const [
      statusCounts,
      accountAggsResult,
      paymentAggsResult,
      agingResult,
      badRecords,
      unsecuredDevices,
    ] = await Promise.all([
      prisma.installmentAccount.groupBy({ by: ["status"], _count: true }),

      prisma.$queryRawUnsafe<Array<{
        total_installment: string;
        total_down: string;
        total_outstanding: string;
        total_cash: string;
        total_installment_price: string;
        total_processing_fees: string;
      }>>(`
        SELECT
          COALESCE(SUM("installmentPrice"), 0)::text AS "total_installment",
          COALESCE(SUM("downPayment"), 0)::text AS "total_down",
          COALESCE(SUM(CASE WHEN status IN ('ACTIVE','OVERDUE','DUE_TODAY') THEN "remainingBalance" ELSE 0 END), 0)::text AS "total_outstanding",
          COALESCE(SUM("cashPrice"), 0)::text AS "total_cash",
          COALESCE(SUM("installmentPrice"), 0)::text AS "total_installment_price",
          COALESCE(SUM("processingFee"), 0)::text AS "total_processing_fees"
        FROM "InstallmentAccount"
      `),

      prisma.$queryRawUnsafe<Array<{
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
        FROM "Payment"
        WHERE "voided" = false`,
        todayStart, todayEnd, weekStart, weekEnd, monthStart, monthEnd,
      ),

      prisma.$queryRawUnsafe<Array<{
        days1to30: number;
        days31to60: number;
        days61to90: number;
        days90plus: number;
      }>>(
        `SELECT
          COUNT(*) FILTER (WHERE days_overdue BETWEEN 1 AND 30)::int AS "days1to30",
          COUNT(*) FILTER (WHERE days_overdue BETWEEN 31 AND 60)::int AS "days31to60",
          COUNT(*) FILTER (WHERE days_overdue BETWEEN 61 AND 90)::int AS "days61to90",
          COUNT(*) FILTER (WHERE days_overdue > 90)::int AS "days90plus"
        FROM (
          SELECT CURRENT_DATE - MIN(sub.due_date)::date AS days_overdue
          FROM (
            SELECT s."installmentAccountId", s."dueDate" as due_date
            FROM "InstallmentSchedule" s
            JOIN "InstallmentAccount" a ON a.id = s."installmentAccountId"
            WHERE a.status = 'OVERDUE'
              AND s.status IN ('PENDING', 'OVERDUE', 'PARTIAL')
              AND s."dueDate" < CURRENT_DATE
          ) sub
          GROUP BY sub."installmentAccountId"
        ) aged`,
      ),

      prisma.installmentAccount.count({ where: { badRecord: true, status: { notIn: ["FULLY_PAID", "CLOSED"] as any } } }),
      prisma.installmentAccount.count({ where: { status: "ACTIVE" as any, deviceEmail: null } }),
    ]);

    const countMap: Record<string, number> = {};
    for (const row of statusCounts) {
      countMap[row.status] = row._count;
    }

    const accountAggs = accountAggsResult[0] ?? { total_installment: "0", total_down: "0", total_outstanding: "0", total_cash: "0", total_installment_price: "0", total_processing_fees: "0" };
    const paymentAggs = paymentAggsResult[0] ?? { total_collections: "0", total_penalties: "0", today: "0", week: "0", month: "0" };
    const agingData = agingResult[0] ?? { days1to30: 0, days31to60: 0, days61to90: 0, days90plus: 0 };

    const totalAccounts = Object.values(countMap).reduce((a, b) => a + b, 0);
    const totalCashPrice = new Decimal(accountAggs.total_cash);
    const totalInstallmentPrice = new Decimal(accountAggs.total_installment_price);

    return NextResponse.json({
      metrics: {
        totalAccounts,
        appliedAccounts: countMap.APPLIED ?? 0,
        activeAccounts: countMap.ACTIVE ?? 0,
        fullyPaidAccounts: countMap.FULLY_PAID ?? 0,
        closedAccounts: countMap.CLOSED ?? 0,
        overdueAccounts: countMap.OVERDUE ?? 0,
        dueTodayAccounts: countMap.DUE_TODAY ?? 0,
        totalInstallmentSales: decimalToString(new Decimal(accountAggs.total_installment)),
        totalInstallmentMargin: decimalToString(totalInstallmentPrice.sub(totalCashPrice)),
        totalDownPayments: decimalToString(new Decimal(accountAggs.total_down)),
        totalProcessingFees: decimalToString(new Decimal(accountAggs.total_processing_fees)),
        totalCollections: decimalToString(new Decimal(paymentAggs.total_collections)),
        outstandingBalances: decimalToString(new Decimal(accountAggs.total_outstanding)),
        totalPenaltiesCollected: decimalToString(new Decimal(paymentAggs.total_penalties)),
        collectionsToday: decimalToString(new Decimal(paymentAggs.today)),
        collectionsThisWeek: decimalToString(new Decimal(paymentAggs.week)),
        collectionsThisMonth: decimalToString(new Decimal(paymentAggs.month)),
        aging: {
          current: (countMap.ACTIVE ?? 0) + (countMap.DUE_TODAY ?? 0),
          days1to30: agingData.days1to30,
          days31to60: agingData.days31to60,
          days61to90: agingData.days61to90,
          days90plus: agingData.days90plus,
        },
      },
      actions: {
        dueToday: countMap.DUE_TODAY ?? 0,
        overdue1to30: agingData.days1to30,
        overdue31plus: agingData.days31to60 + agingData.days61to90 + agingData.days90plus,
        unactivated: countMap.APPLIED ?? 0,
        badRecords,
        unsecuredDevices,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
