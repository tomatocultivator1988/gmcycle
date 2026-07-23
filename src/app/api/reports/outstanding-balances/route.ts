import Decimal from "decimal.js";
import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api";
import { dateToManilaDateOnly, isBeforeManilaToday } from "@/lib/dates";
import { decimalToString } from "@/lib/money";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 50));

    const [allAccounts] = await Promise.all([
      prisma.installmentAccount.findMany({
        where: { status: { notIn: ["APPLIED", "CLOSED"] as any } },
        orderBy: { remainingBalance: "desc" },
      }),
    ]);

    const allIds = allAccounts.map((a) => a.id);
    const schedulePeriods = allIds.length > 0
      ? await prisma.installmentSchedule.findMany({
          where: { installmentAccountId: { in: allIds } },
          select: { installmentAccountId: true, dueDate: true, status: true },
        })
      : [];
    const scheduleByAccount = new Map<string, typeof schedulePeriods>();
    for (const s of schedulePeriods) {
      if (!scheduleByAccount.has(s.installmentAccountId)) {
        scheduleByAccount.set(s.installmentAccountId, []);
      }
      scheduleByAccount.get(s.installmentAccountId)!.push(s);
    }

    const now = new Date();
    const todayStr = dateToManilaDateOnly(now);

    const computedAccounts = allAccounts.filter((a) => {
      const periods = scheduleByAccount.get(a.id) ?? [];
      const unpaid = periods.filter((s) => s.status !== "PAID");

      if (unpaid.length === 0 && periods.length > 0) {
        return false; // FULLY_PAID — exclude
      }
      if (unpaid.length > 0) {
        const isOverdue = unpaid.some((s) => isBeforeManilaToday(s.dueDate));
        const isDueToday = unpaid.some((s) => dateToManilaDateOnly(s.dueDate) === todayStr);
        return isOverdue || isDueToday || true; // ACTIVE, OVERDUE, or DUE_TODAY
      }
      return new Decimal(a.remainingBalance.toString()).gt(0);
    });

    const activeAccounts = computedAccounts.map((a) => {
      const periods = scheduleByAccount.get(a.id) ?? [];
      const unpaid = periods.filter((s) => s.status !== "PAID");
      let computedStatus = a.status;
      if (unpaid.length > 0) {
        const isOverdue = unpaid.some((s) => isBeforeManilaToday(s.dueDate));
        const isDueToday = unpaid.some((s) => dateToManilaDateOnly(s.dueDate) === todayStr);
        computedStatus = isOverdue ? "OVERDUE" : isDueToday ? "DUE_TODAY" : "ACTIVE";
      }
      return { ...a, computedStatus };
    });

    const totalCount = activeAccounts.length;
    const pagedAccounts = activeAccounts.slice((page - 1) * limit, page * limit);

    const totalOutstanding = pagedAccounts.reduce(
      (sum, a) => sum.plus(new Decimal(a.remainingBalance.toString())),
      new Decimal(0),
    );

    const grandTotal = activeAccounts.reduce(
      (sum, a) => sum.plus(new Decimal(a.remainingBalance.toString())),
      new Decimal(0),
    );

    return NextResponse.json({
      accounts: pagedAccounts.map((a) => ({
        id: a.id,
        customerName: a.customerName,
        customerPhone: a.customerPhone,
        brand: a.brand,
        model: a.model,
        remainingBalance: decimalToString(a.remainingBalance),
        monthlyInstallment: decimalToString(a.monthlyInstallment),
        scheduleType: a.scheduleType,
        nextDueDate: dateToManilaDateOnly(a.nextDueDate),
        status: a.computedStatus,
        term: a.term,
      })),
      totalOutstanding: decimalToString(totalOutstanding),
      grandTotal: decimalToString(grandTotal),
      count: totalCount,
      pagination: { page, limit, total: totalCount, totalPages: Math.ceil(totalCount / limit) },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
