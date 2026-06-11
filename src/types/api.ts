export type AccountStatusValue = "APPLIED" | "ACTIVE" | "DUE_TODAY" | "OVERDUE" | "FULLY_PAID" | "CLOSED";
export type ScheduleTypeValue = "SEMI_MONTHLY" | "MONTHLY";
export type PaymentMethod = "CASH" | "GCASH" | "BANK";
export type PaymentTypeValue = "REGULAR" | "PARTIAL" | "ADVANCE" | "FULL";
export type ScheduleStatusValue = "PENDING" | "PAID" | "OVERDUE" | "PARTIAL";

export type InstallmentAccountDto = {
  id: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  customerAddress: string;
  brand: string;
  model: string;
  unitDescription: string;
  itemType: string;
  cashPrice: string;
  installmentPrice: string;
  downPayment: string;
  processingFee: string;
  remainingBalance: string;
  grossProfit: string;
  interestRate: string | null;
  term: number;
  monthlyInstallment: string;
  status: AccountStatusValue;
  scheduleType: ScheduleTypeValue;
  dueDays: number[];
  firstDueDate: string | null;
  dateGiven: string | null;
  startDate: string;
  nextDueDate: string;
  badRecord: boolean;
  badRecordRemark: string | null;
  deviceEmail: string | null;
  deviceEmailPassword: string | null;
  deviceAccountHolderEmail: string | null;
  remarks: string | null;
  customFields: Record<string, string> | null;
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
  notes: string | null;
  cashier: string | null;
  proofUrl: string | null;
  voided: boolean;
  voidedAt: string | null;
  voidReason: string | null;
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

export type DashboardActionsDto = {
  dueToday: number;
  overdue1to30: number;
  overdue31plus: number;
  unactivated: number;
  badRecords: number;
  unsecuredDevices: number;
};

export type DashboardMetricsDto = {
  totalAccounts: number;
  appliedAccounts: number;
  activeAccounts: number;
  fullyPaidAccounts: number;
  overdueAccounts: number;
  dueTodayAccounts: number;
  totalInstallmentSales: string;
  totalInstallmentMargin: string;
  totalDownPayments: string;
  totalCollections: string;
  outstandingBalances: string;
  totalPenaltiesCollected: string;
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
  penaltyPerDay: string;
  adminEmail: string | null;
};
