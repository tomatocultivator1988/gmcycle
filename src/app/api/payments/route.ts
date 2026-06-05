import { differenceInCalendarDays } from "date-fns";
import Decimal from "decimal.js";
import { NextResponse } from "next/server";
import { handleApiError, readJson } from "@/lib/api";
import { parseDateOnly } from "@/lib/dates";
import { computePenalty } from "@/lib/penalty";
import { computeAdvanceDiscount } from "@/lib/discount";
import { NotFoundError } from "@/lib/errors";
import { decimalToString } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { serializePayment } from "@/lib/serializers";
import { createPaymentSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = createPaymentSchema.parse(await readJson(request));
    const paymentDate = parseDateOnly(body.paymentDate, "paymentDate");

    const payment = await prisma.$transaction(async (tx) => {
      const account = await tx.installmentAccount.findUnique({
        where: { id: body.installmentAccountId },
        include: { schedule: { orderBy: { periodNumber: "asc" } } },
      });

      if (!account) {
        throw new NotFoundError("Installment account not found");
      }

      const config = await tx.adminConfig.findFirst();
      const penaltyAmount = config?.penaltyAmount ?? new Decimal("200.00");
      const discountAmount = config?.discountAmount ?? new Decimal("200.00");
      const totalAmount = new Decimal(body.totalAmount);
      const dueDate = account.nextDueDate;

      const currentPeriod = account.schedule.find(
        (s) => s.status === "PENDING" || s.status === "PARTIAL",
      );

      if (!currentPeriod) {
        throw new NotFoundError("No unpaid periods found");
      }

      // --- PENALTY (7+ days late) ---
      let computedPenalty = new Decimal(0);
      if (body.paymentType !== "ADVANCE") {
        computedPenalty = computePenalty(dueDate, paymentDate, { penaltyAmount });
      }

      const currentPeriodOriginalAmount = new Decimal(currentPeriod.amount);
      const currentPeriodExistingPenalty = new Decimal(currentPeriod.penaltyAmount);

      // Store penalty on the schedule period (separate from base amount)
      if (computedPenalty.gt(0) && currentPeriodExistingPenalty.eq(0)) {
        await tx.installmentSchedule.update({
          where: { id: currentPeriod.id },
          data: { penaltyAmount: decimalToString(computedPenalty) },
        });
      }

      // Total due for current period = amount + penalty
      const currentPeriodTotalDue = currentPeriodOriginalAmount.plus(
        computedPenalty.gt(0) ? computedPenalty : currentPeriodExistingPenalty,
      );

      // --- DISCOUNT + EXCESS (early AND overpayment) ---
      let computedDiscount = new Decimal(0);
      let excess = new Decimal(0);
      const isEarly = differenceInCalendarDays(dueDate, paymentDate) > 0;
      const isOverpayment = totalAmount.gt(currentPeriodOriginalAmount);

      if (isEarly && isOverpayment) {
        computedDiscount = computeAdvanceDiscount(dueDate, paymentDate, { discountAmount });
        excess = totalAmount.minus(currentPeriodOriginalAmount);
      }

      // Find next unpaid period (for excess carry-over)
      const currentIndex = account.schedule.findIndex((s) => s.id === currentPeriod.id);
      const nextPeriod = currentIndex < account.schedule.length - 1
        ? account.schedule[currentIndex + 1]
        : null;

      // Apply carry-over + discount to next period's amount
      if (computedDiscount.gt(0) && nextPeriod) {
        const reduction = excess.plus(computedDiscount);
        const nextAmount = Decimal.max(
          new Decimal(0),
          new Decimal(nextPeriod.amount).minus(reduction),
        ).toDecimalPlaces(2);

        await tx.installmentSchedule.update({
          where: { id: nextPeriod.id },
          data: { amount: decimalToString(nextAmount) },
        });

        // If reduction exceeds next period's amount, cascade remaining
        if (reduction.gt(new Decimal(nextPeriod.amount))) {
          let remainingReduction = reduction.minus(new Decimal(nextPeriod.amount));
          for (let i = currentIndex + 2; i < account.schedule.length; i++) {
            if (remainingReduction.lte(0)) break;
            const laterPeriod = account.schedule[i];
            const laterAmount = new Decimal(laterPeriod.amount);
            const newLaterAmount = Decimal.max(
              new Decimal(0),
              laterAmount.minus(remainingReduction),
            ).toDecimalPlaces(2);
            const actualReduction = laterAmount.minus(newLaterAmount);
            remainingReduction = remainingReduction.minus(actualReduction);
            await tx.installmentSchedule.update({
              where: { id: laterPeriod.id },
              data: { amount: decimalToString(newLaterAmount) },
            });
          }
        }
      }

      // --- CREATE PAYMENT ---
      const createdPayment = await tx.payment.create({
        data: {
          installmentAccountId: body.installmentAccountId,
          customerName: account.customerName,
          totalAmount: decimalToString(totalAmount),
          paymentDate,
          method: body.method,
          paymentType: body.paymentType,
          penaltyAmount: decimalToString(computedPenalty),
          discountAmount: decimalToString(computedDiscount),
          notes: body.notes || null,
          cashier: body.cashier || null,
        },
      });

      // --- PENALTY RECORD ---
      if (computedPenalty.gt(0)) {
        await tx.penaltyRecord.create({
          data: {
            installmentAccountId: body.installmentAccountId,
            paymentId: createdPayment.id,
            amount: decimalToString(computedPenalty),
            appliedDate: paymentDate,
            reason: `Late payment (${body.paymentDate} past due ${new Intl.DateTimeFormat("en-CA").format(dueDate)})`,
          },
        });
      }

      // --- DISCOUNT RECORD ---
      if (computedDiscount.gt(0)) {
        await tx.discountRecord.create({
          data: {
            installmentAccountId: body.installmentAccountId,
            paymentId: createdPayment.id,
            amount: decimalToString(computedDiscount),
            appliedDate: paymentDate,
            reason: `Advance payment discount — excess ₱${excess} carried to period ${nextPeriod?.periodNumber ?? "N/A"}`,
          },
        });
      }

      // --- APPLY PAYMENT TO SCHEDULE PERIODS ---
      const updatedSchedule = await tx.installmentSchedule.findMany({
        where: { installmentAccountId: account.id },
        orderBy: { periodNumber: "asc" },
      });

      let remainingToApply = totalAmount;

      for (const period of updatedSchedule) {
        if (remainingToApply.lte(0)) break;
        if (period.status === "PAID") continue;

        const periodPenalty = period.id === currentPeriod.id
          ? Decimal.max(computedPenalty, new Decimal(period.penaltyAmount))
          : new Decimal(period.penaltyAmount);
        const periodBaseAmount = new Decimal(period.amount);
        const periodTotalDue = periodBaseAmount.plus(periodPenalty);

        let paidForPeriod = Decimal.min(remainingToApply, periodTotalDue);

        if (paidForPeriod.gte(periodTotalDue)) {
          await tx.installmentSchedule.update({
            where: { id: period.id },
            data: {
              status: "PAID",
              paidDate: paymentDate,
              paymentId: createdPayment.id,
              paidAmount: decimalToString(paidForPeriod),
            },
          });
        } else if (paidForPeriod.gt(0)) {
          await tx.installmentSchedule.update({
            where: { id: period.id },
            data: {
              status: "PARTIAL",
              paidDate: paymentDate,
              paymentId: createdPayment.id,
              paidAmount: decimalToString(paidForPeriod),
            },
          });
        }

        remainingToApply = remainingToApply.minus(paidForPeriod);
      }

      // --- RECALCULATE REMAINING BALANCE ---
      const allSchedule = await tx.installmentSchedule.findMany({
        where: { installmentAccountId: account.id },
      });

      const newBalance = allSchedule
        .filter((s) => s.status === "PENDING" || s.status === "PARTIAL")
        .reduce(
          (sum, s) => sum.plus(new Decimal(s.amount)).plus(new Decimal(s.penaltyAmount)),
          new Decimal(0),
        )
        .toDecimalPlaces(2);

      // --- DETERMINE NEXT DUE DATE & STATUS ---
      const unpaidPeriods = allSchedule
        .filter((s) => s.status === "PENDING" || s.status === "PARTIAL")
        .sort((a, b) => a.periodNumber - b.periodNumber);

      const nextUnpaid = unpaidPeriods[0];
      const nextDue = nextUnpaid?.dueDate ?? account.nextDueDate;

      let status: "ACTIVE" | "FULLY_PAID" | "OVERDUE" | "DUE_TODAY" = "ACTIVE";

      if (newBalance.eq(0)) {
        status = "FULLY_PAID";
      } else if (nextUnpaid) {
        const todayStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(paymentDate);
        const dueStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(nextUnpaid.dueDate);

        if (todayStr > dueStr) {
          status = "OVERDUE";
        } else if (todayStr === dueStr) {
          status = "DUE_TODAY";
        }
      }

      await tx.installmentAccount.update({
        where: { id: body.installmentAccountId },
        data: {
          remainingBalance: decimalToString(newBalance),
          status,
          nextDueDate: nextDue,
        },
      });

      return createdPayment;
    });

    return NextResponse.json({ payment: serializePayment(payment) }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
