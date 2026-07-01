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
      orderBy: { customerName: "asc" },
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

    const nextDueAmountMap = new Map<string, Decimal>();
    const totalPenaltiesMap = new Map<string, Decimal>();
    if (accountIds.length > 0) {
      const nextUnpaid = await prisma.installmentSchedule.findMany({
        where: {
          installmentAccountId: { in: accountIds },
          status: { in: ["PENDING", "PARTIAL", "OVERDUE"] },
        },
        orderBy: { periodNumber: "asc" },
        distinct: ["installmentAccountId"],
      });
      for (const s of nextUnpaid) {
        const amt = new Decimal(s.amount.toString()).plus(new Decimal(s.penaltyAmount?.toString() ?? "0"));
        nextDueAmountMap.set(s.installmentAccountId, amt);
      }

      const penaltySums = await prisma.installmentSchedule.groupBy({
        by: ["installmentAccountId"],
        where: {
          installmentAccountId: { in: accountIds },
          status: { in: ["PENDING", "PARTIAL", "OVERDUE"] },
        },
        _sum: { penaltyAmount: true },
      });
      for (const r of penaltySums) {
        totalPenaltiesMap.set(r.installmentAccountId, r._sum.penaltyAmount ?? new Decimal(0));
      }
    }

    const totalAmountDueMap = new Map<string, Decimal>();
    const dueBreakdownMap = new Map<string, Array<{ period: number; dueDate: string; amount: string; penalty: string }>>();
    if (accountIds.length > 0) {
      const todayMidnight = new Date();
      todayMidnight.setHours(0, 0, 0, 0);
      const tomorrow = new Date(todayMidnight.getTime() + 86400000);

      const dueNow = await prisma.installmentSchedule.findMany({
        where: {
          installmentAccountId: { in: accountIds },
          status: { in: ["PENDING", "PARTIAL", "OVERDUE"] },
          dueDate: { lt: tomorrow },
        },
        orderBy: { periodNumber: "asc" },
      });

      for (const s of dueNow) {
        const penalty = new Decimal(s.penaltyAmount?.toString() ?? "0");
        const total = new Decimal(s.amount.toString()).plus(penalty);
        const current = totalAmountDueMap.get(s.installmentAccountId) ?? new Decimal(0);
        totalAmountDueMap.set(s.installmentAccountId, current.plus(total));

        if (!dueBreakdownMap.has(s.installmentAccountId)) {
          dueBreakdownMap.set(s.installmentAccountId, []);
        }
        dueBreakdownMap.get(s.installmentAccountId)!.push({
          period: s.periodNumber,
          dueDate: dateToManilaDateOnly(s.dueDate),
          amount: decimalToString(s.amount),
          penalty: decimalToString(penalty),
        });
      }
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

    let lastPaymentMap = new Map<string, { lastPaymentDate: string; lastPaymentAmount: Decimal }>();
    let totalPaidMap = new Map<string, Decimal>();

    if (pagedIds.length > 0) {
      const combined = await prisma.$queryRawUnsafe<Array<{
        installmentAccountId: string;
        last_payment_date: Date | null;
        last_payment_amount: Decimal | null;
        total_paid: Decimal | null;
      }>>(
        `SELECT DISTINCT ON ("installmentAccountId")
          "installmentAccountId",
          "paymentDate" AS last_payment_date,
          "totalAmount" AS last_payment_amount,
          SUM("totalAmount") OVER (PARTITION BY "installmentAccountId") AS total_paid
        FROM "Payment"
        WHERE "installmentAccountId" = ANY($1::text[]) AND "voided" = false
        ORDER BY "installmentAccountId", "paymentDate" DESC`,
        pagedIds,
      );

      for (const r of combined) {
        lastPaymentMap.set(r.installmentAccountId, {
          lastPaymentDate: r.last_payment_date ? dateToManilaDateOnly(r.last_payment_date) : "",
          lastPaymentAmount: r.last_payment_amount ?? new Decimal(0),
        });
        totalPaidMap.set(r.installmentAccountId, r.total_paid ?? new Decimal(0));
      }
    }

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

    // Fetch earliest overdue schedule period per account
    const overduePeriods = pagedIds.length > 0
      ? await prisma.installmentSchedule.groupBy({
          by: ["installmentAccountId"],
          where: {
            installmentAccountId: { in: pagedIds },
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
      const nextDue = dateToManilaDateOnly(a.nextDueDate);
      const earliestOverdue = earliestOverdueMap.get(a.id);
      const daysOverdue = earliestOverdue
        ? Math.floor((new Date().getTime() - earliestOverdue.getTime()) / (1000 * 60 * 60 * 24))
        : 0;
      const lastPayInfo = lastPaymentMap.get(a.id);
      const accountSchedules = scheduleMap.get(a.id) ?? [];
      const allPaid = accountSchedules.length > 0 && accountSchedules.every((s) => s.status === "PAID");
      const unpaidSchedules = accountSchedules.filter((s) => s.status !== "PAID");
      const isDueToday = unpaidSchedules.some((s) => dateToManilaDateOnly(s.dueDate) === todayStr);

      let computedStatus: string;
      if (allPaid) {
        computedStatus = "FULLY_PAID";
      } else if (daysOverdue > 0) {
        computedStatus = "OVERDUE";
      } else if (isDueToday) {
        computedStatus = "DUE_TODAY";
      } else {
        computedStatus = "ACTIVE";
      }

      let dueLabel = daysOverdue > 0 ? `${daysOverdue}d overdue` : nextDue === todayStr || isDueToday ? "Due Today" : nextDue;
      if (allPaid) dueLabel = "Paid";

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
        status: computedStatus,
        scheduleType: a.scheduleType,
        dueDays: a.dueDays,
        nextDueDate: nextDue,
        dueLabel,
        daysOverdue,
        lastPaymentDate: lastPayInfo ? lastPayInfo.lastPaymentDate : null,
        lastPaymentAmount: lastPayInfo ? decimalToString(lastPayInfo.lastPaymentAmount) : null,
        totalPaid: decimalToString(totalPaidMap.get(a.id) ?? new Decimal(0)),
        nextAmountDue: decimalToString(nextDueAmountMap.get(a.id) ?? new Decimal(0)),
        totalPenalties: decimalToString(totalPenaltiesMap.get(a.id) ?? new Decimal(0)),
        totalAmountDue: decimalToString(totalAmountDueMap.get(a.id) ?? new Decimal(0)),
        dueBreakdown: dueBreakdownMap.get(a.id) ?? [],
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
