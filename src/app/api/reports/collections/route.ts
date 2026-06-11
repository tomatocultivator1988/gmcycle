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

    const [payments, totalCount] = await Promise.all([
      prisma.payment.findMany({
        where: { voided: false },
        orderBy: { paymentDate: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          installmentAccount: { select: { id: true, brand: true, model: true, customerName: true } },
        },
      }),
      prisma.payment.count({ where: { voided: false } }),
    ]);

    const total = payments.reduce(
      (sum, p) => sum.plus(new Decimal(p.totalAmount.toString())),
      new Decimal(0),
    );

    return NextResponse.json({
      collections: payments.map((p) => ({
        id: p.id,
        accountId: p.installmentAccount.id,
        customerName: p.installmentAccount.customerName,
        brand: p.installmentAccount.brand,
        model: p.installmentAccount.model,
        amount: decimalToString(p.totalAmount),
        paymentDate: dateToManilaDateOnly(p.paymentDate),
        method: p.method,
        paymentType: p.paymentType,
        cashier: p.cashier,
      })),
      total: decimalToString(total),
      pagination: { page, limit, total: totalCount, totalPages: Math.ceil(totalCount / limit) },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
