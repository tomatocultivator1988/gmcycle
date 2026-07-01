import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api";
import { dateToManilaDateOnly } from "@/lib/dates";
import { decimalToString } from "@/lib/money";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");
    const statusFilter = searchParams.get("status");
    const limit = Math.min(500, Math.max(1, Number(searchParams.get("limit")) || 200));

    const where: Record<string, unknown> = {
      customerEmail: { not: null },
    };

    if (date) {
      where.nextDueDate = { lte: new Date(date + "T23:59:59.999+08:00") };
    }

    const [accounts, total] = await Promise.all([
      prisma.installmentAccount.findMany({
        where,
        orderBy: { customerName: "asc" },
        take: limit,
      }),
      prisma.installmentAccount.count({ where }),
    ]);

    const accountIds = accounts.map((a) => a.id);
    const schedulePeriods = accountIds.length > 0
      ? await prisma.installmentSchedule.findMany({
          where: { installmentAccountId: { in: accountIds } },
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

    let rows = accounts.map((a) => {
      const periods = scheduleByAccount.get(a.id) ?? [];
      const unpaid = periods.filter((s) => s.status !== "PAID");

      let computedStatus = a.status;
      if (a.status !== "APPLIED" && a.status !== "CLOSED") {
        if (unpaid.length === 0 && periods.length > 0) {
          computedStatus = "FULLY_PAID";
        } else if (unpaid.length > 0) {
          const isOverdue = unpaid.some((s) => s.dueDate < now);
          const isDueToday = unpaid.some((s) => dateToManilaDateOnly(s.dueDate) === todayStr);
          computedStatus = isOverdue ? "OVERDUE" : isDueToday ? "DUE_TODAY" : "ACTIVE";
        }
      }

      return {
        id: a.id,
        customerName: a.customerName,
        customerPhone: a.customerPhone,
        customerEmail: a.customerEmail,
        brand: a.brand,
        model: a.model,
        unitDescription: a.unitDescription,
        status: computedStatus,
        nextDueDate: dateToManilaDateOnly(a.nextDueDate),
        remainingBalance: decimalToString(a.remainingBalance),
        monthlyInstallment: decimalToString(a.monthlyInstallment),
        term: a.term,
      };
    });

    if (statusFilter) {
      const statuses = statusFilter.split(",").filter(Boolean);
      if (statuses.length > 0) {
        rows = rows.filter((r) => statuses.includes(r.status));
      }
    } else {
      rows = rows.filter((r) => ["ACTIVE", "OVERDUE", "DUE_TODAY"].includes(r.status));
    }

    return NextResponse.json({ accounts: rows, total });
  } catch (error) {
    return handleApiError(error);
  }
}
