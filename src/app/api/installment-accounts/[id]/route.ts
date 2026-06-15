import Decimal from "decimal.js";
import { NextResponse } from "next/server";
import { handleApiError, readJson } from "@/lib/api";
import { parseDateOnly, dateToManilaDateOnly } from "@/lib/dates";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { decimalToString, parsePositiveMoney } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { recalculateBalance } from "@/lib/balance";
import { updateOverdueSchedule } from "@/lib/schedule-status";
import { serializeInstallmentAccount } from "@/lib/serializers";
import { findClosestIndex } from "@/lib/installment-schedule";
import { updateInstallmentAccountSchema, fullUpdateAccountSchema } from "@/lib/validation";

export const runtime = "nodejs";

async function getAdminPassword(): Promise<string> {
  const config = await prisma.adminConfig.findFirst();
  return config?.adminPassword || "buratnianjo123";
}

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const account = await prisma.installmentAccount.findUnique({
      where: { id },
    });

    if (!account) {
      throw new NotFoundError("Installment account not found");
    }

    await updateOverdueSchedule(id);

    const updated = await prisma.$transaction(async (tx) => {
      await recalculateBalance(tx, id);
      return tx.installmentAccount.findUnique({ where: { id } });
    });

    if (!updated) {
      throw new NotFoundError("Installment account not found after balance update");
    }

    return NextResponse.json({
      installmentAccount: serializeInstallmentAccount(updated),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const raw = await readJson(request) as Record<string, unknown>;

    const isFullUpdate = typeof raw.password === "string" && raw.password.length > 0;

    if (isFullUpdate) {
      return handleFullUpdate(id, raw);
    }

    const body = updateInstallmentAccountSchema.parse(raw);

    const existing = await prisma.installmentAccount.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError("Installment account not found");

    const updateData: Record<string, unknown> = {
      customerName: body.customerName,
      customerPhone: body.customerPhone,
      customerEmail: body.customerEmail ?? null,
      customerAddress: body.customerAddress,
      fbLink: body.fbLink || null,
      brand: body.brand,
      model: body.model,
      unitDescription: body.unitDescription,
    };
    if (body.itemType !== undefined) updateData.itemType = body.itemType;
    if (body.processingFee !== undefined) updateData.processingFee = body.processingFee?.trim() || "0.00";
    if (body.customFields !== undefined) updateData.customFields = body.customFields;

    const updated = await prisma.installmentAccount.update({ where: { id }, data: updateData });
    return NextResponse.json({ installmentAccount: serializeInstallmentAccount(updated) });
  } catch (error) {
    return handleApiError(error);
  }
}

async function handleFullUpdate(id: string, raw: Record<string, unknown>) {
  const body = fullUpdateAccountSchema.parse(raw);

  const adminPassword = await getAdminPassword();
  if (body.password !== adminPassword) {
    return NextResponse.json({ error: "Incorrect admin password" }, { status: 401 });
  }

  const existing = await prisma.installmentAccount.findUnique({
    where: { id },
    include: { schedule: { orderBy: { periodNumber: "asc" } } },
  });
  if (!existing) throw new NotFoundError("Installment account not found");

  const cashPrice = parsePositiveMoney(body.cashPrice, "cashPrice");
  const downPayment = parsePositiveMoney(body.downPayment, "downPayment");
  const processingFee = body.processingFee?.trim()
    ? parsePositiveMoney(body.processingFee, "processingFee")
    : new Decimal(0);
  const rate = new Decimal(body.interestRate).div(100);
  const term = body.term;
  const scheduleType = body.scheduleType;
  const dueDays = body.dueDays;
  const firstDueDate = parseDateOnly(body.firstDueDate, "firstDueDate");
  const dateGiven = body.dateGiven?.trim() ? parseDateOnly(body.dateGiven, "dateGiven") : null;

  if (dueDays.length > 1) {
    const sorted = [...dueDays].sort((a, b) => a - b);
    if (sorted[0] === sorted[1]) {
      throw new ValidationError("Due days must be distinct");
    }
    if (sorted[0] > sorted[1]) {
      throw new ValidationError("Due days must be in ascending order");
    }
  }

  const financed = cashPrice.minus(downPayment);
  const totalInterest = body.itemType === "CASH"
    ? financed.times(rate)
    : financed.times(rate).times(term);
  const installmentPrice = cashPrice.plus(totalInterest).toDecimalPlaces(2);
  const totalPeriods = scheduleType === "SEMI_MONTHLY" ? term * 2 : term;

  const paidPeriods = existing.schedule.filter((s) => s.status === "PAID");
  const partialPeriods = existing.schedule.filter((s) => s.status === "PARTIAL");
  const preservedNumbers = new Set([...paidPeriods, ...partialPeriods].map((s) => s.periodNumber));

  const fullPaidTotal = paidPeriods.reduce((sum, p) => sum.plus(p.amount), new Decimal(0));
  const partialPaidTotal = partialPeriods.reduce((sum, p) => sum.plus(p.paidAmount || 0), new Decimal(0));
  const paidTotal = fullPaidTotal.plus(partialPaidTotal);
  const unpaidCount = totalPeriods - preservedNumbers.size;

  const contractBalance = installmentPrice.minus(downPayment);
  const remainingBalance = contractBalance.minus(paidTotal).toDecimalPlaces(2);
  const monthlyInstallment = unpaidCount > 0
    ? remainingBalance.div(unpaidCount).toDecimalPlaces(2)
    : new Decimal(0);

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.installmentAccount.update({
      where: { id },
      data: {
        customerName: body.customerName,
        customerPhone: body.customerPhone,
        customerEmail: body.customerEmail ?? null,
        customerAddress: body.customerAddress,
        fbLink: body.fbLink || null,
        brand: body.itemType === "CASH" ? "N/A" : body.brand,
        model: body.itemType === "CASH" ? "N/A" : body.model,
        unitDescription: body.unitDescription,
        itemType: body.itemType,
        cashPrice: decimalToString(cashPrice),
        installmentPrice: decimalToString(installmentPrice),
        downPayment: decimalToString(downPayment),
        processingFee: decimalToString(processingFee),
        remainingBalance: decimalToString(remainingBalance),
        term,
        monthlyInstallment: decimalToString(monthlyInstallment),
        interestRate: body.interestRate?.trim() || null,
        scheduleType,
        dueDays,
        firstDueDate,
        dateGiven,
        customFields: body.customFields ?? {},
        nextDueDate: firstDueDate,
        status: existing.status,
      },
    });

    // Delete unpaid periods (PENDING + OVERDUE) and regenerate
    await tx.installmentSchedule.deleteMany({
      where: { installmentAccountId: id, status: { in: ["PENDING", "OVERDUE"] } },
    });

    // Generate new periods for the remaining term
    const scheduleEntries: Array<Record<string, unknown>> = [];
    let allocated = new Decimal(0);
    let generatedCount = 0;

    for (let i = 1; i <= totalPeriods; i++) {
      if (preservedNumbers.has(i)) continue;
      generatedCount++;

      const dueDate = computeDueDate(firstDueDate, dueDays, scheduleType, i);
      let amount: Decimal;
      if (generatedCount === unpaidCount) {
        amount = remainingBalance.minus(allocated);
      } else {
        amount = monthlyInstallment;
        allocated = allocated.plus(amount);
      }

      scheduleEntries.push({
        installmentAccountId: id,
        periodNumber: i,
        dueDate,
        amount: amount.toDecimalPlaces(2).toString(),
        status: "PENDING" as any,
      });
    }

    if (scheduleEntries.length > 0) {
      await tx.installmentSchedule.createMany({ data: scheduleEntries as any });
    }

    // Update surviving PARTIAL periods to new per-period amount
    if (partialPeriods.length > 0 && monthlyInstallment.gt(0)) {
      await tx.installmentSchedule.updateMany({
        where: { installmentAccountId: id, status: "PARTIAL" },
        data: { amount: decimalToString(monthlyInstallment) },
      });
    }

    await tx.activityLog.create({
      data: {
        accountId: id,
        action: "CONTRACT_EDIT",
        details: `Contract terms edited. Financed: ₱${financed.toFixed(2)}, Term: ${term}mo, Schedule: ${scheduleType}`,
      },
    });

    return result;
  });

  return NextResponse.json({ installmentAccount: serializeInstallmentAccount(updated) });
}

function computeDueDate(startDate: Date, dueDays: number[], scheduleType: string, periodNumber: number): Date {
  const sorted = [...dueDays].sort((a, b) => a - b);
  if (scheduleType === "MONTHLY") {
    const d = new Date(startDate);
    d.setMonth(d.getMonth() + (periodNumber - 1));
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    const day = sorted[0];
    d.setDate(Math.min(day, lastDay));
    return d;
  } else {
    const periodsPerMonth = 2;
    const startDay = parseInt(dateToManilaDateOnly(startDate).slice(8, 10), 10);
    const startIdx = findClosestIndex(sorted, startDay);
    const adjustedPeriod = (periodNumber - 1) + startIdx;
    const monthsOffset = Math.floor(adjustedPeriod / periodsPerMonth);
    const isFirstHalf = adjustedPeriod % periodsPerMonth === 0;
    const d = new Date(startDate);
    d.setMonth(d.getMonth() + monthsOffset);
    const day = isFirstHalf ? sorted[0] : (sorted[1] ?? sorted[0]);
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(day, lastDay));
    return d;
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await readJson(request) as { password: string };

    const adminPassword = await getAdminPassword();
    if (!body.password || body.password !== adminPassword) {
      return NextResponse.json({ error: "Incorrect admin password" }, { status: 401 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.penaltyRecord.deleteMany({ where: { installmentAccountId: id } });
      await tx.activityLog.deleteMany({ where: { accountId: id } });
      await tx.payment.deleteMany({ where: { installmentAccountId: id } });
      await tx.installmentSchedule.deleteMany({ where: { installmentAccountId: id } });
      await tx.installmentAccount.delete({ where: { id } });
    });

    return NextResponse.json({ message: "Account and all associated records permanently deleted" });
  } catch (error) {
    return handleApiError(error);
  }
}
