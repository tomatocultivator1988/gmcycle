import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api";
import { dateToManilaDateOnly } from "@/lib/dates";
import { decimalToString } from "@/lib/money";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  try {
    const accounts = await prisma.installmentAccount.findMany({
      where: { status: "OVERDUE" },
      orderBy: { nextDueDate: "asc" },
    });

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
      totalOverdue: accounts.length,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
