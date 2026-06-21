import Decimal from "decimal.js";
import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api";
import { dateToManilaDateOnly } from "@/lib/dates";
import { decimalToString } from "@/lib/money";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 50));

    const [accounts, totalCount, grandTotalResult] = await Promise.all([
      prisma.installmentAccount.findMany({
        where: { status: { in: ["ACTIVE", "OVERDUE", "DUE_TODAY"] as any } },
        orderBy: { remainingBalance: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.installmentAccount.count({
        where: { status: { in: ["ACTIVE", "OVERDUE", "DUE_TODAY"] as any } },
      }),
      prisma.installmentAccount.aggregate({
        where: { status: { in: ["ACTIVE", "OVERDUE", "DUE_TODAY"] as any } },
        _sum: { remainingBalance: true },
      }),
    ]);

    const totalOutstanding = accounts.reduce(
      (sum, a) => sum.plus(new Decimal(a.remainingBalance.toString())),
      new Decimal(0),
    );

    const grandTotal = new Decimal(grandTotalResult._sum.remainingBalance?.toString() ?? "0");

    return NextResponse.json({
      accounts: accounts.map((a) => ({
        id: a.id,
        customerName: a.customerName,
        customerPhone: a.customerPhone,
        brand: a.brand,
        model: a.model,
        remainingBalance: decimalToString(a.remainingBalance),
        monthlyInstallment: decimalToString(a.monthlyInstallment),
        scheduleType: a.scheduleType,
        nextDueDate: dateToManilaDateOnly(a.nextDueDate),
        status: a.status,
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
