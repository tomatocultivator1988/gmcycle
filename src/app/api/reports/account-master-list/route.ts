import Decimal from "decimal.js";
import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api";
import { dateToManilaDateOnly, getManilaTodayDateString } from "@/lib/dates";
import { decimalToString } from "@/lib/money";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 50));
    const date = searchParams.get("date");
    const paidStatus = searchParams.get("paidStatus");

    const scheduleEndDate = date ? new Date(date + "T23:59:59.999+08:00") : undefined;

    const whereBase: Record<string, unknown> = {
      status: { notIn: ["APPLIED", "CLOSED"] },
    };
    if (scheduleEndDate) {
      whereBase.schedule = { some: { dueDate: { lte: scheduleEndDate } } };
    }

    const allAccounts = await prisma.installmentAccount.findMany({
      where: whereBase,
    });

    const accountIds = allAccounts.map((a) => a.id);
    const schedules = accountIds.length > 0
      ? await prisma.installmentSchedule.findMany({
          where: {
            installmentAccountId: { in: accountIds },
            ...(scheduleEndDate ? { dueDate: { lte: scheduleEndDate } } : {}),
          },
        })
      : [];

    const scheduleMap = new Map<string, typeof schedules>();
    for (const s of schedules) {
      if (!scheduleMap.has(s.installmentAccountId)) {
        scheduleMap.set(s.installmentAccountId, []);
      }
      scheduleMap.get(s.installmentAccountId)!.push(s);
    }

    const paid: typeof allAccounts = [];
    const unpaid: typeof allAccounts = [];
    for (const a of allAccounts) {
      const accountSchedules = scheduleMap.get(a.id) ?? [];
      if (accountSchedules.length > 0 && accountSchedules.every((s) => s.status === "PAID")) {
        paid.push(a);
      } else {
        unpaid.push(a);
      }
    }

    let filteredAccounts: typeof allAccounts;
    if (paidStatus === "paid") {
      filteredAccounts = paid;
    } else if (paidStatus === "unpaid") {
      filteredAccounts = unpaid;
    } else {
      filteredAccounts = allAccounts;
    }

    const totalFiltered = filteredAccounts.length;
    const pagedAccounts = filteredAccounts.slice((page - 1) * limit, page * limit);

    const pagedIds = pagedAccounts.map((a) => a.id);
    const lastPayments = pagedIds.length > 0
      ? await prisma.payment.findMany({
          where: {
            installmentAccountId: { in: pagedIds },
            voided: false,
          },
          orderBy: { paymentDate: "desc" },
          distinct: ["installmentAccountId"],
        })
      : [];

    const paymentMap = new Map(lastPayments.map((p) => [p.installmentAccountId, p]));

    const allDueDays = [...new Set(allAccounts.flatMap((a) => a.dueDays))].sort((a, b) => a - b);
    const totalBalance = allAccounts.reduce(
      (sum, a) => sum.plus(new Decimal(a.remainingBalance.toString())),
      new Decimal(0),
    );

    const paymentWhere: Record<string, unknown> = {
      installmentAccountId: { in: accountIds },
      voided: false,
    };
    if (scheduleEndDate) {
      paymentWhere.paymentDate = { lte: scheduleEndDate };
    }
    const totalCollectedResult = accountIds.length > 0
      ? await prisma.payment.aggregate({
          where: paymentWhere,
          _sum: { totalAmount: true },
        })
      : null;
    const totalCollected = totalCollectedResult?._sum?.totalAmount
      ? decimalToString(totalCollectedResult._sum.totalAmount)
      : "0.00";

    const todayStr = getManilaTodayDateString();

    const rows = pagedAccounts.map((a) => {
      const nextDue = dateToManilaDateOnly(a.nextDueDate);
      const daysOverdue = nextDue < todayStr
        ? Math.floor((new Date().getTime() - a.nextDueDate.getTime()) / (1000 * 60 * 60 * 24))
        : 0;
      const lastPay = paymentMap.get(a.id);
      let dueLabel = daysOverdue > 0 ? `${daysOverdue}d overdue` : nextDue === todayStr ? "Due Today" : nextDue;
      if (a.status === "FULLY_PAID") dueLabel = "Paid";

      return {
        id: a.id,
        customerName: a.customerName,
        customerPhone: a.customerPhone,
        brand: a.brand,
        model: a.model,
        unitDescription: a.unitDescription,
        cashPrice: decimalToString(a.cashPrice),
        installmentPrice: decimalToString(a.installmentPrice),
        downPayment: decimalToString(a.downPayment),
        remainingBalance: decimalToString(a.remainingBalance),
        monthlyInstallment: decimalToString(a.monthlyInstallment),
        term: a.term,
        status: a.status,
        scheduleType: a.scheduleType,
        dueDays: a.dueDays,
        nextDueDate: nextDue,
        dueLabel,
        daysOverdue,
        lastPaymentDate: lastPay ? dateToManilaDateOnly(lastPay.paymentDate) : null,
        lastPaymentAmount: lastPay ? decimalToString(lastPay.totalAmount) : null,
      };
    });

    return NextResponse.json({
      accounts: rows,
      allCount: allAccounts.length,
      paidCount: paid.length,
      unpaidCount: unpaid.length,
      totalAccounts: allAccounts.length,
      totalBalance: decimalToString(totalBalance),
      totalCollected,
      dueDays: allDueDays,
      pagination: { page, limit, total: totalFiltered, totalPages: Math.ceil(totalFiltered / limit) },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
