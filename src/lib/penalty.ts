import { differenceInCalendarDays } from "date-fns";
import Decimal from "decimal.js";

export function computePenalty(
  dueDate: Date,
  paymentDate: Date,
  config: { penaltyAmount: Decimal },
): Decimal {
  const diffDays = differenceInCalendarDays(paymentDate, dueDate);

  if (diffDays >= 7) {
    return config.penaltyAmount;
  }

  return new Decimal(0);
}
