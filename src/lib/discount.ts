import { differenceInCalendarDays } from "date-fns";
import Decimal from "decimal.js";

export function computeAdvanceDiscount(
  dueDate: Date,
  paymentDate: Date,
  config: { discountAmount: Decimal },
): Decimal {
  const diffDays = differenceInCalendarDays(dueDate, paymentDate);

  if (diffDays > 0) {
    return config.discountAmount;
  }

  return new Decimal(0);
}
