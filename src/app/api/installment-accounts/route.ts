import Decimal from "decimal.js";
import { NextResponse } from "next/server";
import { handleApiError, readJson } from "@/lib/api";
import { parseDateOnly } from "@/lib/dates";
import { ValidationError } from "@/lib/errors";
import { decimalToString, parsePositiveMoney } from "@/lib/money";
import { generateSchedule } from "@/lib/installment-schedule";
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

    const where = search
      ? {
          OR: [
            { customerName: { contains: search, mode: "insensitive" as const } },
            { brand: { contains: search, mode: "insensitive" as const } },
            { model: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {};

    const [accounts, total] = await Promise.all([
      prisma.installmentAccount.findMany({
        where,
        orderBy: { createdAt: "desc" },
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
    const installmentPrice = parsePositiveMoney(body.installmentPrice, "installmentPrice");
    const downPayment = parsePositiveMoney(body.downPayment, "downPayment");

    if (downPayment.gte(installmentPrice)) {
      throw new ValidationError("Down payment cannot equal or exceed installment price");
    }

    const remainingBalance = installmentPrice.minus(downPayment).toDecimalPlaces(2);
    const monthlyInstallment = remainingBalance.div(body.term).toDecimalPlaces(2);
    const startDate = parseDateOnly(body.startDate, "startDate");
    const dueDay = body.dueDayOfMonth;
    const term = body.term;

    const firstDueDate = new Date(
      startDate.getFullYear(),
      startDate.getMonth() + 1,
      Math.min(dueDay, new Date(startDate.getFullYear(), startDate.getMonth() + 2, 0).getDate()),
    );

    const schedule = generateSchedule(startDate, dueDay, term, monthlyInstallment, remainingBalance);

    const account = await prisma.$transaction(async (tx) => {
      const created = await tx.installmentAccount.create({
        data: {
          customerName: body.customerName,
          customerPhone: body.customerPhone,
          customerAddress: body.customerAddress,
          brand: body.brand,
          model: body.model,
          unitDescription: body.unitDescription,
          cashPrice: decimalToString(cashPrice),
          installmentPrice: decimalToString(installmentPrice),
          downPayment: decimalToString(downPayment),
          remainingBalance: decimalToString(remainingBalance),
          term,
          monthlyInstallment: decimalToString(monthlyInstallment),
          startDate,
          dueDayOfMonth: dueDay,
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

    return NextResponse.json(
      { installmentAccount: serializeInstallmentAccount(account) },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}
