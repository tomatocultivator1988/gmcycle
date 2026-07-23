import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api";
import { dateToManilaDateOnly, getManilaTodayDateString, isBeforeManilaToday } from "@/lib/dates";
import { decimalToString } from "@/lib/money";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 50));
    const date = searchParams.get("date");

    const whereBase: Record<string, unknown> = {
      status: { notIn: ["APPLIED", "CLOSED"] as any },
    };

    if (date) {
      whereBase.nextDueDate = { lte: new Date(date + "T23:59:59.999+08:00") };
    }

    const [allAccounts] = await Promise.all([
      prisma.installmentAccount.findMany({
        where: whereBase,
        orderBy: { nextDueDate: "asc" },
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
    const todayStr = getManilaTodayDateString();

    const computedAccounts = allAccounts.map((a) => {
      const periods = scheduleByAccount.get(a.id) ?? [];
      const unpaid = periods.filter((s) => s.status !== "PAID");

      let computedStatus = a.status;
      if (a.status !== "APPLIED" && a.status !== "CLOSED") {
        if (unpaid.length === 0 && periods.length > 0) {
          computedStatus = "FULLY_PAID";
        } else if (unpaid.length > 0) {
          const isOverdue = unpaid.some((s) => isBeforeManilaToday(s.dueDate));
          const isDueToday = unpaid.some((s) => dateToManilaDateOnly(s.dueDate) === todayStr);
          computedStatus = isOverdue ? "OVERDUE" : isDueToday ? "DUE_TODAY" : "ACTIVE";
        }
      }

      return { ...a, computedStatus };
    });

    const activeAccounts = computedAccounts.filter(
      (a) => a.computedStatus === "ACTIVE" || a.computedStatus === "OVERDUE" || a.computedStatus === "DUE_TODAY",
    );
    const totalCount = activeAccounts.length;
    const overdueCount = activeAccounts.filter((a) => a.computedStatus === "OVERDUE").length;
    const pagedAccounts = activeAccounts.slice((page - 1) * limit, page * limit);
    const accountIds = pagedAccounts.map((a) => a.id);

    // All unique due days across all accounts
    const allDueDays = [
      ...new Set(allAccounts.flatMap((a) => a.dueDays)),
    ].sort((a, b) => a - b);

    // Fetch last payment per account
    const lastPayments = accountIds.length > 0
      ? await prisma.payment.findMany({
          where: {
            installmentAccountId: { in: accountIds },
            voided: false,
          },
          orderBy: { paymentDate: "desc" },
          distinct: ["installmentAccountId"],
        })
      : [];

    const paymentMap = new Map(lastPayments.map((p) => [p.installmentAccountId, p]));

    // Fetch earliest overdue schedule period per account
    const overduePeriods = accountIds.length > 0
      ? await prisma.installmentSchedule.groupBy({
          by: ["installmentAccountId"],
          where: {
            installmentAccountId: { in: accountIds },
            status: { in: ["PENDING", "OVERDUE", "PARTIAL"] },
            dueDate: { lt: new Date() },
          },
          _min: { dueDate: true },
        })
      : [];
    const earliestOverdueMap = new Map(
      overduePeriods.map((p) => [p.installmentAccountId, p._min.dueDate]),
    );

    const rows = pagedAccounts.map((a) => {
      const earliestOverdue = earliestOverdueMap.get(a.id);
      const daysOverdue = earliestOverdue
        ? Math.floor((new Date().getTime() - earliestOverdue.getTime()) / (1000 * 60 * 60 * 24))
        : 0;
      const nextDue = dateToManilaDateOnly(a.nextDueDate);
      const lastPay = paymentMap.get(a.id);
      let dueLabel = daysOverdue > 0 ? `${daysOverdue}d overdue` : nextDue === todayStr ? "Due Today" : nextDue;
      if (a.computedStatus === "FULLY_PAID") dueLabel = "Paid";

      return {
        id: a.id,
        customerName: a.customerName,
        customerPhone: a.customerPhone,
        brand: a.brand,
        model: a.model,
        unitDescription: a.unitDescription,
        remainingBalance: decimalToString(a.remainingBalance),
        monthlyInstallment: decimalToString(a.monthlyInstallment),
        nextDueDate: nextDue,
        dueDays: a.dueDays,
        scheduleType: a.scheduleType,
        dueLabel,
        daysOverdue,
        status: a.computedStatus,
        lastPaymentDate: lastPay ? dateToManilaDateOnly(lastPay.paymentDate) : null,
        lastPaymentAmount: lastPay ? decimalToString(lastPay.totalAmount) : null,
      };
    });

    return NextResponse.json({
      accounts: rows,
      totalOverdue: overdueCount,
      totalFiltered: totalCount,
      dueDays: allDueDays,
      pagination: { page, limit, total: totalCount, totalPages: Math.ceil(totalCount / limit) },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
