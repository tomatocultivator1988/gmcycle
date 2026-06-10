import Decimal from "decimal.js";
import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api";
import { decimalToString } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { dateToManilaDateOnly } from "@/lib/dates";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 50));

    const [penalties, totalCount] = await Promise.all([
      prisma.penaltyRecord.findMany({
        orderBy: { appliedDate: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          installmentAccount: { select: { brand: true, model: true, customerName: true } },
        },
      }),
      prisma.penaltyRecord.count(),
    ]);

    const total = penalties.reduce(
      (sum, p) => sum.plus(new Decimal(p.amount.toString())),
      new Decimal(0),
    );

    return NextResponse.json({
      penalties: penalties.map((p) => ({
        id: p.id,
        customerName: p.installmentAccount.customerName,
        unit: `${p.installmentAccount.brand} ${p.installmentAccount.model}`,
        amount: decimalToString(p.amount),
        appliedDate: dateToManilaDateOnly(p.appliedDate),
        reason: p.reason,
      })),
      total: decimalToString(total),
      count: totalCount,
      pagination: { page, limit, total: totalCount, totalPages: Math.ceil(totalCount / limit) },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
