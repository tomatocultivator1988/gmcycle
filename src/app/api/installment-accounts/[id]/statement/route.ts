import { differenceInCalendarDays } from "date-fns";
import Decimal from "decimal.js";
import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api";
import { dateToManilaDateOnly } from "@/lib/dates";
import { NotFoundError } from "@/lib/errors";
import { decimalToString } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { recalculateBalance } from "@/lib/balance";
import { updateOverdueSchedule } from "@/lib/schedule-status";
import { serializeInstallmentAccount, serializeInstallmentSchedule, serializePayment, serializePenaltyRecord } from "@/lib/serializers";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;

    // Update overdue statuses before fetching statement data
    await updateOverdueSchedule(id);
    await prisma.$transaction(async (tx) => { await recalculateBalance(tx, id); });

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

    const config = await prisma.adminConfig.findFirst();
    const penaltyPerDay = config?.penaltyPerDay
      ? new Decimal(config.penaltyPerDay.toString())
      : new Decimal("50");

    const generatedAt = new Date();
    const todayManila = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());

    return NextResponse.json({
      statement: {
        generatedAt: generatedAt.toISOString(),
      customerName: account.customerName,
      customerAddress: account.customerAddress,
      customerPhone: account.customerPhone,
      customerEmail: account.customerEmail,
      brand: account.brand,
      model: account.model,
      unitDescription: account.unitDescription,
      itemType: account.itemType,
      cashPrice: decimalToString(cashPrice),
      installmentPrice: decimalToString(installmentPrice),
      downPayment: decimalToString(downPayment),
      remainingBalance: decimalToString(account.remainingBalance),
      grossProfit: decimalToString(grossProfit),
      interestRate: account.interestRate,
      term: account.term,
      scheduleType: account.scheduleType,
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
        schedule: account.schedule.map((s) => {
          const dueStr = new Intl.DateTimeFormat("en-CA", {
            timeZone: "Asia/Manila",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          }).format(s.dueDate);
          const daysOverdue = s.status === "PAID"
            ? null
            : todayManila > dueStr
              ? differenceInCalendarDays(new Date(todayManila), new Date(dueStr))
              : 0;
          const storedPenalty = new Decimal(s.penaltyAmount);
          const computedPenalty = daysOverdue && daysOverdue > 0 && storedPenalty.eq(0)
            ? penaltyPerDay.times(daysOverdue)
            : new Decimal(0);
          const effectivePenalty = storedPenalty.gt(0) ? storedPenalty : computedPenalty;
          return {
            period: s.periodNumber,
            dueDate: dateToManilaDateOnly(s.dueDate),
            amount: decimalToString(s.amount),
            status: s.status,
            paidDate: s.paidDate ? dateToManilaDateOnly(s.paidDate) : null,
            paidAmount: s.paidAmount ? decimalToString(s.paidAmount) : null,
            penalty: decimalToString(effectivePenalty),
            daysOverdue,
          };
        }),
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
