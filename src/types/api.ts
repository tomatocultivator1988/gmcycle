export type AccountStatusValue = "ACTIVE" | "DUE_TODAY" | "OVERDUE" | "FULLY_PAID";
export type PaymentMethod = "CASH" | "GCASH" | "BANK";
export type PaymentTypeValue = "REGULAR" | "PARTIAL" | "ADVANCE" | "FULL";
export type ScheduleStatusValue = "PENDING" | "PAID" | "OVERDUE" | "PARTIAL";

export type InstallmentAccountDto = {
  id: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  brand: string;
  model: string;
  unitDescription: string;
  cashPrice: string;
  installmentPrice: string;
  downPayment: string;
  remainingBalance: string;
  term: number;
  monthlyInstallment: string;
  status: AccountStatusValue;
  startDate: string;
  dueDayOfMonth: number;
  nextDueDate: string;
  createdAt: string;
  updatedAt: string;
};

export type InstallmentScheduleDto = {
  id: string;
  installmentAccountId: string;
  periodNumber: number;
  dueDate: string;
  amount: string;
  status: ScheduleStatusValue;
  paidDate: string | null;
  paymentId: string | null;
  paidAmount: string | null;
  penaltyAmount: string;
  discountAmount: string;
};

export type PaymentDto = {
  id: string;
  installmentAccountId: string;
  customerName: string;
  totalAmount: string;
  paymentDate: string;
  method: PaymentMethod;
  paymentType: PaymentTypeValue;
  penaltyAmount: string;
  discountAmount: string;
  notes: string | null;
  cashier: string | null;
  createdAt: string;
};

export type PenaltyRecordDto = {
  id: string;
  installmentAccountId: string;
  paymentId: string;
  amount: string;
  appliedDate: string;
  reason: string | null;
};

export type DiscountRecordDto = {
  id: string;
  installmentAccountId: string;
  paymentId: string;
  amount: string;
  appliedDate: string;
  reason: string | null;
};

export type DashboardMetricsDto = {
  totalAccounts: number;
  activeAccounts: number;
  fullyPaidAccounts: number;
  overdueAccounts: number;
  dueTodayAccounts: number;
  totalInstallmentSales: string;
  totalDownPayments: string;
  totalCollections: string;
  outstandingBalances: string;
  totalPenaltiesCollected: string;
  totalDiscountsGranted: string;
  collectionsToday: string;
  collectionsThisWeek: string;
  collectionsThisMonth: string;
  aging: {
    current: number;
    days1to30: number;
    days31to60: number;
    days61to90: number;
    days90plus: number;
  };
};

export type AdminConfigDto = {
  id: string;
  penaltyAmount: string;
  discountAmount: string;
  dueDayOptions: number[];
};
