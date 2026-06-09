import Decimal from "decimal.js";

export type InstallmentScheduleInput = {
  periodNumber: number;
  dueDate: Date;
  amount: Decimal;
  status: "PENDING";
};

const DUE_DAYS = [15, 30] as const;

function getLastDayOfMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function makeDueDate(year: number, month: number, day: number): Date {
  const lastDay = getLastDayOfMonth(year, month);
  const safeDay = Math.min(day, lastDay);
  return new Date(year, month, safeDay, 0, 0, 0, 0);
}

export function generateSchedule(
  startDate: Date,
  term: number,
  totalRemainingBalance: Decimal,
): InstallmentScheduleInput[] {
  const totalPeriods = term * 2;
  const schedule: InstallmentScheduleInput[] = [];
  let allocated = new Decimal(0);

  for (let i = 1; i <= totalPeriods; i++) {
    const dueDate = computeSemiMonthlyDueDate(startDate, i);
    let amount: Decimal;

    if (i === totalPeriods) {
      amount = totalRemainingBalance.minus(allocated);
    } else {
      amount = totalRemainingBalance.div(totalPeriods);
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

export function computeSemiMonthlyDueDate(startDate: Date, periodIndex: number): Date {
  if (periodIndex < 1) throw new Error("periodIndex must be >= 1");
  const monthOffset = Math.ceil(periodIndex / 2) - 1;
  const dayIndex = (periodIndex - 1) % 2;
  const targetDay = DUE_DAYS[dayIndex];

  const startMonth = startDate.getMonth();
  const startYear = startDate.getFullYear();
  const targetMonth = (startMonth + monthOffset) % 12;
  const yearOffset = Math.floor((startMonth + monthOffset) / 12);
  const targetYear = startYear + yearOffset;

  return makeDueDate(targetYear, targetMonth, targetDay);
}
