import { differenceInCalendarDays } from "date-fns";
import Decimal from "decimal.js";

export function computeAccruedPenalty(
  dueDate: Date,
  today: Date,
  config: { penaltyPerDay: Decimal },
): { daysOverdue: number; accrued: Decimal } {
  const diffDays = differenceInCalendarDays(today, dueDate);

  if (diffDays <= 0) {
    return { daysOverdue: 0, accrued: new Decimal(0) };
  }

  return {
    daysOverdue: diffDays,
    accrued: config.penaltyPerDay.times(diffDays).toDecimalPlaces(2),
  };
}
