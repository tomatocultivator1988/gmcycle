import Decimal from "decimal.js";
import { isBeforeManilaToday, getManilaTodayDateString } from "./dates";
import type { AccountStatusValue } from "@/types/api";

export function determineInstallmentAccountStatus(
  remainingBalance: Decimal.Value,
  nextDueDate: Date,
  now = new Date(),
  currentStatus?: AccountStatusValue,
): AccountStatusValue {
  if (currentStatus === "APPLIED" || currentStatus === "FULLY_PAID") {
    return currentStatus;
  }

  const balance = new Decimal(remainingBalance);

  if (balance.eq(0)) {
    return "FULLY_PAID";
  }

  const todayStr = getManilaTodayDateString(now);
  const dueStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(nextDueDate);

  if (dueStr === todayStr) {
    return "DUE_TODAY";
  }

  if (isBeforeManilaToday(nextDueDate, now)) {
    return "OVERDUE";
  }

  return "ACTIVE";
}
