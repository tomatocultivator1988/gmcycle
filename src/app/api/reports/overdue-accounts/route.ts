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

    const [accounts, totalCount] = await Promise.all([
      prisma.installmentAccount.findMany({
        where: { status: "OVERDUE" as any },
        orderBy: { nextDueDate: "asc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.installmentAccount.count({
        where: { status: "OVERDUE" as any },
      }),
    ]);

    const now = new Date();

    return NextResponse.json({
      accounts: accounts.map((a) => {
        const daysOverdue = Math.floor(
          (now.getTime() - a.nextDueDate.getTime()) / (1000 * 60 * 60 * 24),
        );

        return {
          id: a.id,
          customerName: a.customerName,
          customerPhone: a.customerPhone,
          brand: a.brand,
          model: a.model,
          remainingBalance: decimalToString(a.remainingBalance),
          monthlyInstallment: decimalToString(a.monthlyInstallment),
          nextDueDate: dateToManilaDateOnly(a.nextDueDate),
          daysOverdue,
        };
      }),
      totalOverdue: totalCount,
      pagination: { page, limit, total: totalCount, totalPages: Math.ceil(totalCount / limit) },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
