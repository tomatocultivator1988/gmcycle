import type { Prisma } from "@/generated/prisma/client";
import { dateToManilaDateOnly } from "@/lib/dates";
import { decimalToString } from "@/lib/money";

type InstallmentAccountShape = Prisma.InstallmentAccountGetPayload<Record<string, never>>;
type InstallmentScheduleShape = Prisma.InstallmentScheduleGetPayload<Record<string, never>>;
type PaymentShape = Prisma.PaymentGetPayload<Record<string, never>>;
type PenaltyRecordShape = Prisma.PenaltyRecordGetPayload<Record<string, never>>;
type DiscountRecordShape = Prisma.DiscountRecordGetPayload<Record<string, never>>;

export function serializeInstallmentAccount(account: InstallmentAccountShape) {
  return {
    ...account,
    cashPrice: decimalToString(account.cashPrice),
    installmentPrice: decimalToString(account.installmentPrice),
    downPayment: decimalToString(account.downPayment),
    remainingBalance: decimalToString(account.remainingBalance),
    monthlyInstallment: decimalToString(account.monthlyInstallment),
    startDate: dateToManilaDateOnly(account.startDate),
    nextDueDate: dateToManilaDateOnly(account.nextDueDate),
    createdAt: account.createdAt.toISOString(),
    updatedAt: account.updatedAt.toISOString(),
  };
}

export function serializeInstallmentSchedule(schedule: InstallmentScheduleShape) {
  return {
    ...schedule,
    amount: decimalToString(schedule.amount),
    dueDate: dateToManilaDateOnly(schedule.dueDate),
    paidDate: schedule.paidDate ? dateToManilaDateOnly(schedule.paidDate) : null,
    paidAmount: schedule.paidAmount ? decimalToString(schedule.paidAmount) : null,
    penaltyAmount: decimalToString(schedule.penaltyAmount),
    discountAmount: decimalToString(schedule.discountAmount),
  };
}

export function serializePayment(payment: PaymentShape) {
  return {
    ...payment,
    totalAmount: decimalToString(payment.totalAmount),
    paymentDate: dateToManilaDateOnly(payment.paymentDate),
    penaltyAmount: decimalToString(payment.penaltyAmount),
    discountAmount: decimalToString(payment.discountAmount),
    createdAt: payment.createdAt.toISOString(),
  };
}

export function serializePenaltyRecord(record: PenaltyRecordShape) {
  return {
    ...record,
    amount: decimalToString(record.amount),
    appliedDate: record.appliedDate.toISOString(),
  };
}

export function serializeDiscountRecord(record: DiscountRecordShape) {
  return {
    ...record,
    amount: decimalToString(record.amount),
    appliedDate: record.appliedDate.toISOString(),
  };
}
