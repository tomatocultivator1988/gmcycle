import type { AccountStatusValue } from "@/types/api";
import { formatPeso } from "@/lib/money";

export function formatAccountStatus(status: AccountStatusValue): string {
  switch (status) {
    case "APPLIED":
      return "Applied";
    case "ACTIVE":
      return "Active";
    case "DUE_TODAY":
      return "Due Today";
    case "OVERDUE":
      return "Overdue";
    case "FULLY_PAID":
      return "Fully Paid";
    case "CLOSED":
      return "Closed";
  }
}

export function formatPricingLabel(rate?: string | null): string {
  return rate ? `Monthly ${rate}% Interest` : "Monthly Interest";
}

export function formatAccountSummary(account: {
  installmentPrice: string;
  downPayment: string;
  totalPayments: string;
  totalPenalties: string;
  remainingBalance: string;
  nextDueDate: string;
  daysOverdue: number;
  status: AccountStatusValue;
}) {
  return {
    installmentPrice: formatPeso(account.installmentPrice),
    downPayment: formatPeso(account.downPayment),
    totalPayments: formatPeso(account.totalPayments),
    totalPenalties: formatPeso(account.totalPenalties),
    remainingBalance: formatPeso(account.remainingBalance),
    nextDueDate: account.nextDueDate,
    daysOverdue: account.daysOverdue,
    status: account.status,
  };
}
