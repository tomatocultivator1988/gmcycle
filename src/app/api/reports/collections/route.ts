import Decimal from "decimal.js";
import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api";
import { dateToManilaDateOnly } from "@/lib/dates";
import { decimalToString } from "@/lib/money";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  try {
    const payments = await prisma.payment.findMany({
      orderBy: { paymentDate: "desc" },
      include: {
        installmentAccount: { select: { id: true, brand: true, model: true, customerName: true } },
      },
    });

    const total = payments.reduce(
      (sum, p) => sum.plus(new Decimal(p.totalAmount.toString())),
      new Decimal(0),
    );

    return NextResponse.json({
      collections: payments.map((p) => ({
        id: p.id,
        customerName: p.installmentAccount.customerName,
        brand: p.installmentAccount.brand,
        model: p.installmentAccount.model,
        amount: decimalToString(p.totalAmount),
        paymentDate: dateToManilaDateOnly(p.paymentDate),
        method: p.method,
      })),
      total: decimalToString(total),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
