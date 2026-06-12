import Decimal from "decimal.js";
import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api";
import { dateToManilaDateOnly } from "@/lib/dates";
import { NotFoundError } from "@/lib/errors";
import { decimalToString } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { serializeInstallmentAccount, serializeInstallmentSchedule, serializePayment, serializePenaltyRecord } from "@/lib/serializers";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;

    const account = await prisma.installmentAccount.findUnique({
      where: { id },
      include: {
        payments: { where: { voided: false }, orderBy: { paymentDate: "asc" } },
        schedule: { orderBy: { periodNumber: "asc" } },
        penalties: { orderBy: { appliedDate: "asc" } },
      },
    });

    if (!account) {
      throw new NotFoundError("Installment account not found");
    }

    const totalPayments = account.payments.reduce(
      (sum, p) => sum.plus(new Decimal(p.totalAmount)),
      new Decimal(0),
    );

    const totalPenalties = account.penalties.reduce(
      (sum, p) => sum.plus(new Decimal(p.amount)),
      new Decimal(0),
    );

    const installmentPrice = new Decimal(account.installmentPrice);
    const downPayment = new Decimal(account.downPayment);
    const cashPrice = new Decimal(account.cashPrice);
    const grossProfit = installmentPrice.sub(cashPrice);

    const generatedAt = new Date();

    return NextResponse.json({
      statement: {
        generatedAt: generatedAt.toISOString(),
        customerName: account.customerName,
        customerPhone: account.customerPhone,
        customerEmail: account.customerEmail,
        customerAddress: account.customerAddress,
        brand: account.brand,
        model: account.model,
        unitDescription: account.unitDescription,
        itemType: account.itemType,
        cashPrice: decimalToString(cashPrice),
        installmentPrice: decimalToString(installmentPrice),
        downPayment: decimalToString(downPayment),
        remainingBalance: decimalToString(account.remainingBalance),
        grossProfit: decimalToString(grossProfit),
        interestRate: account.interestRate ? decimalToString(account.interestRate) : null,
        term: account.term,
        monthlyInstallment: decimalToString(account.monthlyInstallment),
        status: account.status,
        startDate: dateToManilaDateOnly(account.startDate),
        dateGiven: account.dateGiven ? dateToManilaDateOnly(account.dateGiven) : null,
        firstDueDate: account.firstDueDate ? dateToManilaDateOnly(account.firstDueDate) : null,
        nextDueDate: dateToManilaDateOnly(account.nextDueDate),
        totalPayments: decimalToString(totalPayments),
        totalPenalties: decimalToString(totalPenalties),
        payments: account.payments.map((p) => ({
          date: dateToManilaDateOnly(p.paymentDate),
          amount: decimalToString(p.totalAmount),
          type: p.paymentType,
          method: p.method,
          penalty: decimalToString(p.penaltyAmount),
          notes: p.notes,
          cashier: p.cashier,
          proofUrl: p.proofUrl,
        })),
        schedule: account.schedule.map((s) => ({
          period: s.periodNumber,
          dueDate: dateToManilaDateOnly(s.dueDate),
          amount: decimalToString(s.amount),
          status: s.status,
          paidDate: s.paidDate ? dateToManilaDateOnly(s.paidDate) : null,
          paidAmount: s.paidAmount ? decimalToString(s.paidAmount) : null,
          penalty: decimalToString(s.penaltyAmount),
        })),
        penalties: account.penalties.map((p) => ({
          amount: decimalToString(p.amount),
          appliedDate: p.appliedDate.toISOString(),
          reason: p.reason,
        })),
      },
      // Raw serialized arrays for account detail page (saves 3 extra HTTP roundtrips)
      installmentAccount: serializeInstallmentAccount(account),
      schedule: account.schedule.map(serializeInstallmentSchedule),
      payments: account.payments.map(serializePayment),
      penalties: account.penalties.map(serializePenaltyRecord),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
