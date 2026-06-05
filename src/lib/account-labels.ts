import type { AccountStatusValue } from "@/types/api";
import { formatPeso } from "@/lib/money";

export function formatAccountStatus(status: AccountStatusValue): string {
  switch (status) {
    case "ACTIVE":
      return "Active";
    case "DUE_TODAY":
      return "Due Today";
    case "OVERDUE":
      return "Overdue";
    case "FULLY_PAID":
      return "Fully Paid";
  }
}

export function formatAccountSummary(account: {
  installmentPrice: string;
  downPayment: string;
  totalPayments: string;
  totalPenalties: string;
  totalDiscounts: string;
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
    totalDiscounts: formatPeso(account.totalDiscounts),
    remainingBalance: formatPeso(account.remainingBalance),
    nextDueDate: account.nextDueDate,
    daysOverdue: account.daysOverdue,
    status: account.status,
  };
}
