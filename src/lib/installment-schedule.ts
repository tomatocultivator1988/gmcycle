import Decimal from "decimal.js";

export type InstallmentScheduleInput = {
  periodNumber: number;
  dueDate: Date;
  amount: Decimal;
  status: "PENDING";
};

export function generateSchedule(
  startDate: Date,
  dueDayOfMonth: number,
  term: number,
  monthlyInstallment: Decimal,
  totalRemainingBalance: Decimal,
): InstallmentScheduleInput[] {
  const schedule: InstallmentScheduleInput[] = [];
  let allocated = new Decimal(0);

  for (let i = 1; i <= term; i++) {
    const dueDate = computeNextDueDate(startDate, dueDayOfMonth, i);
    let amount: Decimal;

    if (i === term) {
      amount = totalRemainingBalance.minus(allocated);
    } else {
      amount = monthlyInstallment;
      allocated = allocated.plus(amount);
    }

    schedule.push({
      periodNumber: i,
      dueDate,
      amount: amount.toDecimalPlaces(2),
      status: "PENDING",
    });
  }

  return schedule;
}

export function computeNextDueDate(startDate: Date, dueDay: number, periodIndex: number): Date {
  const startMonth = startDate.getMonth();
  const startYear = startDate.getFullYear();
  const targetMonth = (startMonth + periodIndex) % 12;
  const yearOffset = Math.floor((startMonth + periodIndex) / 12);
  const targetYear = startYear + yearOffset;
  const lastDay = new Date(targetYear, targetMonth + 1, 0).getDate();
  const safeDay = Math.min(dueDay, lastDay);

  return new Date(targetYear, targetMonth, safeDay, 0, 0, 0, 0);
}
