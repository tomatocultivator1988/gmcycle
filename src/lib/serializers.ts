import type { Prisma } from "@/generated/prisma/client";
import { dateToManilaDateOnly } from "@/lib/dates";
import { decimalToString } from "@/lib/money";

type InstallmentAccountShape = Prisma.InstallmentAccountGetPayload<Record<string, never>>;
type InstallmentScheduleShape = Prisma.InstallmentScheduleGetPayload<Record<string, never>>;
type PaymentShape = Prisma.PaymentGetPayload<Record<string, never>>;
type PenaltyRecordShape = Prisma.PenaltyRecordGetPayload<Record<string, never>>;

export function serializeInstallmentAccount(account: InstallmentAccountShape) {
  return {
    id: account.id,
    customerName: account.customerName,
    customerPhone: account.customerPhone,
    customerEmail: account.customerEmail ?? null,
    customerAddress: account.customerAddress,
    brand: account.brand,
    model: account.model,
    unitDescription: account.unitDescription,
    itemType: account.itemType,
    cashPrice: decimalToString(account.cashPrice),
    installmentPrice: decimalToString(account.installmentPrice),
    downPayment: decimalToString(account.downPayment),
    processingFee: decimalToString(account.processingFee ?? "0.00"),
    remainingBalance: decimalToString(account.remainingBalance),
    grossProfit: decimalToString(account.installmentPrice.minus(account.cashPrice)),
    pricingType: account.pricingType,
    interestRate: account.interestRate ? decimalToString(account.interestRate) : null,
    monthlyInstallment: decimalToString(account.monthlyInstallment),
    status: account.status,
    scheduleType: account.scheduleType,
    dueDays: account.dueDays,
    firstDueDate: account.firstDueDate ? dateToManilaDateOnly(account.firstDueDate) : null,
    term: account.term,
    startDate: dateToManilaDateOnly(account.startDate),
    nextDueDate: dateToManilaDateOnly(account.nextDueDate),
    badRecord: account.badRecord,
    badRecordRemark: account.badRecordRemark ?? null,
    deviceEmail: account.deviceEmail ?? null,
    deviceAccountHolderEmail: account.deviceAccountHolderEmail ?? null,
    remarks: account.remarks ?? null,
    customFields: account.customFields ?? null,
    createdAt: account.createdAt.toISOString(),
    updatedAt: account.updatedAt.toISOString(),
  };
}

export function serializeInstallmentSchedule(schedule: InstallmentScheduleShape) {
  return {
    id: schedule.id,
    installmentAccountId: schedule.installmentAccountId,
    periodNumber: schedule.periodNumber,
    amount: decimalToString(schedule.amount),
    dueDate: dateToManilaDateOnly(schedule.dueDate),
    status: schedule.status,
    paidDate: schedule.paidDate ? dateToManilaDateOnly(schedule.paidDate) : null,
    paymentId: schedule.paymentId,
    paidAmount: schedule.paidAmount ? decimalToString(schedule.paidAmount) : null,
    penaltyAmount: decimalToString(schedule.penaltyAmount),
  };
}

export function serializePayment(payment: PaymentShape) {
  return {
    id: payment.id,
    installmentAccountId: payment.installmentAccountId,
    customerName: payment.customerName,
    totalAmount: decimalToString(payment.totalAmount),
    paymentDate: dateToManilaDateOnly(payment.paymentDate),
    method: payment.method,
    paymentType: payment.paymentType,
    penaltyAmount: decimalToString(payment.penaltyAmount),
    notes: payment.notes,
    cashier: payment.cashier,
    proofUrl: payment.proofUrl ?? null,
    voided: payment.voided,
    voidedAt: payment.voidedAt?.toISOString() ?? null,
    voidReason: payment.voidReason ?? null,
    createdAt: payment.createdAt.toISOString(),
  };
}

export function serializePenaltyRecord(record: PenaltyRecordShape) {
  return {
    id: record.id,
    installmentAccountId: record.installmentAccountId,
    paymentId: record.paymentId,
    amount: decimalToString(record.amount),
    appliedDate: record.appliedDate.toISOString(),
    reason: record.reason,
  };
}

