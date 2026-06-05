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

    const [
      totalAccounts,
      activeAccounts,
      fullyPaidAccounts,
      overdueAccounts,
      totalInstallmentSales,
      totalDownPayments,
      totalOutstanding,
      totalCollections,
      totalPenalties,
      totalDiscounts,
      collectionsToday,
      collectionsThisWeek,
      collectionsThisMonth,
    ] = await Promise.all([
      prisma.installmentAccount.count(),
      prisma.installmentAccount.count({ where: { status: "ACTIVE" } }),
      prisma.installmentAccount.count({ where: { status: "FULLY_PAID" } }),
      prisma.installmentAccount.count({ where: { status: "OVERDUE" } }),
      prisma.installmentAccount.aggregate({ _sum: { installmentPrice: true } }),
      prisma.installmentAccount.aggregate({ _sum: { downPayment: true } }),
      prisma.installmentAccount.aggregate({
        where: { status: { in: ["ACTIVE", "OVERDUE", "DUE_TODAY"] } },
        _sum: { remainingBalance: true },
      }),
      prisma.payment.aggregate({ _sum: { totalAmount: true } }),
      prisma.payment.aggregate({ _sum: { penaltyAmount: true } }),
      prisma.payment.aggregate({ _sum: { discountAmount: true } }),
      prisma.payment.aggregate({
        where: { paymentDate: { gte: todayStart, lt: todayEnd } },
        _sum: { totalAmount: true },
      }),
      prisma.payment.aggregate({
        where: { paymentDate: { gte: weekStart, lt: weekEnd } },
        _sum: { totalAmount: true },
      }),
      prisma.payment.aggregate({
        where: { paymentDate: { gte: monthStart, lt: monthEnd } },
        _sum: { totalAmount: true },
      }),
    ]);

    const dueTodayAccounts = await prisma.installmentAccount.count({
      where: { status: "DUE_TODAY" },
    });

    const overdueAccountsList = await prisma.installmentAccount.findMany({
      where: { status: "OVERDUE" },
      select: { nextDueDate: true },
    });

    const today = todayStart;
    let days1to30 = 0;
    let days31to60 = 0;
    let days61to90 = 0;
    let days90plus = 0;

    for (const acc of overdueAccountsList) {
      const diffDays = Math.floor((today.getTime() - acc.nextDueDate.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays <= 30) days1to30++;
      else if (diffDays <= 60) days31to60++;
      else if (diffDays <= 90) days61to90++;
      else days90plus++;
    }

    const currentAccounts = await prisma.installmentAccount.count({
      where: { status: { in: ["ACTIVE", "DUE_TODAY"] } },
    });

    return NextResponse.json({
      metrics: {
        totalAccounts,
        activeAccounts,
        fullyPaidAccounts,
        overdueAccounts,
        dueTodayAccounts,
        totalInstallmentSales: decimalToString(totalInstallmentSales._sum.installmentPrice?.toString() ?? "0"),
        totalDownPayments: decimalToString(totalDownPayments._sum.downPayment?.toString() ?? "0"),
        totalCollections: decimalToString(totalCollections._sum.totalAmount?.toString() ?? "0"),
        outstandingBalances: decimalToString(totalOutstanding._sum.remainingBalance?.toString() ?? "0"),
        totalPenaltiesCollected: decimalToString(totalPenalties._sum.penaltyAmount?.toString() ?? "0"),
        totalDiscountsGranted: decimalToString(totalDiscounts._sum.discountAmount?.toString() ?? "0"),
        collectionsToday: decimalToString(collectionsToday._sum.totalAmount?.toString() ?? "0"),
        collectionsThisWeek: decimalToString(collectionsThisWeek._sum.totalAmount?.toString() ?? "0"),
        collectionsThisMonth: decimalToString(collectionsThisMonth._sum.totalAmount?.toString() ?? "0"),
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
