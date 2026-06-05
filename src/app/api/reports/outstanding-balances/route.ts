import Decimal from "decimal.js";
import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api";
import { dateToManilaDateOnly } from "@/lib/dates";
import { decimalToString } from "@/lib/money";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  try {
    const accounts = await prisma.installmentAccount.findMany({
      where: { status: { in: ["ACTIVE", "OVERDUE", "DUE_TODAY"] } },
      orderBy: { remainingBalance: "desc" },
    });

    const totalOutstanding = accounts.reduce(
      (sum, a) => sum.plus(new Decimal(a.remainingBalance.toString())),
      new Decimal(0),
    );

    return NextResponse.json({
      accounts: accounts.map((a) => ({
        id: a.id,
        customerName: a.customerName,
        customerPhone: a.customerPhone,
        brand: a.brand,
        model: a.model,
        remainingBalance: decimalToString(a.remainingBalance),
        monthlyInstallment: decimalToString(a.monthlyInstallment),
        nextDueDate: dateToManilaDateOnly(a.nextDueDate),
        status: a.status,
        term: a.term,
      })),
      totalOutstanding: decimalToString(totalOutstanding),
      count: accounts.length,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
