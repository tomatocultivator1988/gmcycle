import Decimal from "decimal.js";
import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api";
import { NotFoundError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { serializePayment } from "@/lib/serializers";
import { dateToManilaDateOnly } from "@/lib/dates";
import { decimalToString } from "@/lib/money";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const payment = await prisma.payment.findUnique({
      where: { id },
      include: {
          installmentAccount: {
            select: {
              customerName: true,
              customerPhone: true,
              customerAddress: true,
              brand: true,
              model: true,
              unitDescription: true,
              monthlyInstallment: true,
              remainingBalance: true,
              term: true,
              scheduleType: true,
            },
          },
      },
    });

    if (!payment) {
      throw new NotFoundError("Payment not found");
    }

      const allPayments = await prisma.payment.findMany({
        where: { installmentAccountId: payment.installmentAccountId, voided: false },
      });

    const totalPaid = allPayments
      .reduce((sum, p) => sum.plus(new Decimal(p.totalAmount)), new Decimal(0))
      .toFixed(2);

    const paidCount = await prisma.installmentSchedule.count({
      where: {
        installmentAccountId: payment.installmentAccountId,
        status: "PAID",
      },
    });
    const totalPeriods = payment.installmentAccount.scheduleType === "SEMI_MONTHLY"
      ? payment.installmentAccount.term * 2
      : payment.installmentAccount.term;

    return NextResponse.json({
      payment: {
        ...serializePayment(payment),
        account: {
          customerName: payment.installmentAccount.customerName,
          customerPhone: payment.installmentAccount.customerPhone,
          customerAddress: payment.installmentAccount.customerAddress,
          brand: payment.installmentAccount.brand,
          model: payment.installmentAccount.model,
          unitDescription: payment.installmentAccount.unitDescription,
          monthlyInstallment: decimalToString(payment.installmentAccount.monthlyInstallment),
          remainingBalance: decimalToString(payment.installmentAccount.remainingBalance),
          scheduleType: payment.installmentAccount.scheduleType,
          totalPaid,
          paidCount,
          totalPeriods,
        },
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
