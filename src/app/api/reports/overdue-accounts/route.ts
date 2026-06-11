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

    const whereBase: Record<string, unknown> = {
      status: { in: ["ACTIVE", "DUE_TODAY", "OVERDUE"] },
    };

    const [accounts, totalCount, overdueCount] = await Promise.all([
      prisma.installmentAccount.findMany({
        where: whereBase,
        orderBy: { nextDueDate: "asc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.installmentAccount.count({ where: whereBase }),
      prisma.installmentAccount.count({
        where: { status: "OVERDUE" as any },
      }),
    ]);

    // All unique due days across all accounts
    const allDueDays = [
      ...new Set(accounts.flatMap((a) => a.dueDays)),
    ].sort((a, b) => a - b);

    // Fetch last payment per account
    const accountIds = accounts.map((a) => a.id);
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

    const todayStr = getManilaTodayDateString();

    const rows = accounts.map((a) => {
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
        remainingBalance: decimalToString(a.remainingBalance),
        monthlyInstallment: decimalToString(a.monthlyInstallment),
        nextDueDate: nextDue,
        dueDays: a.dueDays,
        scheduleType: a.scheduleType,
        dueLabel,
        daysOverdue,
        status: a.status,
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
