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

    const where: Record<string, unknown> = {
      customerEmail: { not: null },
    };

    if (statusFilter) {
      const statuses = statusFilter.split(",").filter(Boolean);
      if (statuses.length > 0) {
        where.status = { in: statuses as any };
      }
    } else {
      where.status = { in: ["ACTIVE", "OVERDUE", "DUE_TODAY"] as any };
    }

    if (date) {
      where.nextDueDate = { lte: new Date(date + "T23:59:59.999+08:00") };
    }

    const accounts = await prisma.installmentAccount.findMany({
      where,
      orderBy: { nextDueDate: "asc" },
    });

    const rows = accounts.map((a) => ({
      id: a.id,
      customerName: a.customerName,
      customerPhone: a.customerPhone,
      customerEmail: a.customerEmail,
      brand: a.brand,
      model: a.model,
      unitDescription: a.unitDescription,
      status: a.status,
      nextDueDate: dateToManilaDateOnly(a.nextDueDate),
      remainingBalance: decimalToString(a.remainingBalance),
      monthlyInstallment: decimalToString(a.monthlyInstallment),
      term: a.term,
    }));

    return NextResponse.json({ accounts: rows, total: rows.length });
  } catch (error) {
    return handleApiError(error);
  }
}
