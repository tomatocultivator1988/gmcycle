import Decimal from "decimal.js";
import { NextResponse } from "next/server";
import { handleApiError, readJson } from "@/lib/api";
import { parseDateOnly } from "@/lib/dates";
import { ValidationError } from "@/lib/errors";
import { decimalToString, parseMoney, parsePositiveMoney, roundTo } from "@/lib/money";
import { generateSchedule } from "@/lib/installment-schedule";
import { sendDpReceipt } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { serializeInstallmentAccount } from "@/lib/serializers";
import { createInstallmentAccountSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 20));
    const search = searchParams.get("search") || "";
    const showClosed = searchParams.get("showClosed") === "true";

    const where: Record<string, unknown> = {};
    if (!showClosed) {
      where.status = { not: "CLOSED" };
    }
    if (search) {
      where.OR = [
        { customerName: { contains: search, mode: "insensitive" as const } },
        { brand: { contains: search, mode: "insensitive" as const } },
        { model: { contains: search, mode: "insensitive" as const } },
      ];
    }

    const [accounts, total] = await Promise.all([
      prisma.installmentAccount.findMany({
        where,
        orderBy: { customerName: "asc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.installmentAccount.count({ where }),
    ]);

    return NextResponse.json({
      installmentAccounts: accounts.map(serializeInstallmentAccount),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = createInstallmentAccountSchema.parse(await readJson(request));

    const cashPrice = parsePositiveMoney(body.cashPrice, "cashPrice");
    const downPayment = parseMoney(body.downPayment);
    const processingFee = body.processingFee?.trim()
      ? parsePositiveMoney(body.processingFee, "processingFee")
      : new Decimal(0);

    // Interest-based formula:
    // Financed = Cash Price - Down Payment
    // For GADGET: Monthly Interest = Financed × Rate%, Total Interest = Monthly Interest × Term
    // For CASH:   Total Interest = Financed × Rate% (one-time)
    if (!body.interestRate) {
      throw new ValidationError("Interest rate is required");
    }
    const rate = new Decimal(body.interestRate).div(100);
    const financed = cashPrice.minus(downPayment);
    const monthlyInterest = financed.times(rate);
    const totalInterest = body.itemType === "CASH"
      ? monthlyInterest  // one-time interest for cash
      : monthlyInterest.times(body.term);  // per-month × term for gadgets
    const installmentPrice = cashPrice.plus(totalInterest).floor();

    if (downPayment.gte(installmentPrice)) {
      throw new ValidationError("Down payment cannot equal or exceed installment price");
    }

    const remainingBalance = installmentPrice.minus(downPayment).floor();
    const term = body.term;
    const scheduleType = body.scheduleType ?? "SEMI_MONTHLY";
    const totalPeriods = scheduleType === "SEMI_MONTHLY" ? term * 2 : term;

    const config = await prisma.adminConfig.findFirst();
    const roundStep = config?.roundStep ?? 100;
    const rawPerPeriod = remainingBalance.div(totalPeriods);
    const monthlyInstallment = roundTo(rawPerPeriod, roundStep);

    const startDate = parseDateOnly(body.startDate || body.firstDueDate, "startDate");
    const firstDueDate = parseDateOnly(body.firstDueDate, "firstDueDate");
    const dateGiven = body.dateGiven?.trim() ? parseDateOnly(body.dateGiven, "dateGiven") : null;
    const dueDays = body.dueDays ?? [15, 30];

    const schedule = generateSchedule(firstDueDate, term, dueDays, remainingBalance, roundStep);

    const account = await prisma.$transaction(async (tx) => {
      const created = await tx.installmentAccount.create({
        data: {
          customerName: body.customerName,
          customerPhone: body.customerPhone,
          customerEmail: body.customerEmail || null,
          customerAddress: body.customerAddress,
          fbLink: body.fbLink || null,
          itemType: body.itemType ?? "GADGET",
          brand: body.itemType === "CASH" ? "N/A" : body.brand,
          model: body.itemType === "CASH" ? "N/A" : body.model,
          unitDescription: body.unitDescription,
          cashPrice: decimalToString(cashPrice),
          installmentPrice: decimalToString(installmentPrice),
          downPayment: decimalToString(downPayment),
          processingFee: decimalToString(processingFee),
          remainingBalance: decimalToString(remainingBalance),
          term,
          monthlyInstallment: decimalToString(monthlyInstallment),
          interestRate: body.interestRate?.trim() || null,
          status: "APPLIED",
          scheduleType,
          dueDays,
          firstDueDate,
          dateGiven,
          startDate,
          customFields: body.customFields ?? {},
          nextDueDate: firstDueDate,
          schedule: {
            create: schedule.map((s) => ({
              periodNumber: s.periodNumber,
              dueDate: s.dueDate,
              amount: decimalToString(s.amount),
              status: "PENDING",
            })),
          },
        },
      });

      return created;
    });

    const serialized = serializeInstallmentAccount(account);
    const emailSent = await sendDpReceipt({
      id: serialized.id,
      customerEmail: serialized.customerEmail,
      customerName: serialized.customerName,
      customerAddress: serialized.customerAddress,
      customerPhone: serialized.customerPhone,
      brand: serialized.brand,
      model: serialized.model,
      unitDescription: serialized.unitDescription,
      downPayment: serialized.downPayment,
      processingFee: serialized.processingFee,
      dateGiven: serialized.dateGiven,
      startDate: serialized.startDate,
      term: serialized.term,
      monthlyInstallment: serialized.monthlyInstallment,
    });

    return NextResponse.json(
      { installmentAccount: serialized, emailSent },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}
