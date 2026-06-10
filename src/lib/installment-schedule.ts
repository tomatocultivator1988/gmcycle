import Decimal from "decimal.js";

export type InstallmentScheduleInput = {
  periodNumber: number;
  dueDate: Date;
  amount: Decimal;
  status: "PENDING";
};

function clampDay(year: number, month: number, day: number): number {
  const lastDay = new Date(year, month + 1, 0).getDate();
  return Math.min(day, lastDay);
}

function makeDueDate(year: number, month: number, day: number): Date {
  const safeDay = clampDay(year, month, day);
  const y = String(year).padStart(4, "0");
  const m = String(month + 1).padStart(2, "0");
  const d = String(safeDay).padStart(2, "0");
  return new Date(`${y}-${m}-${d}T00:00:00+08:00`);
}

export function generateSchedule(
  firstDueDate: Date,
  term: number,
  dueDays: number[],
  totalRemainingBalance: Decimal,
): InstallmentScheduleInput[] {
  const sortedDays = [...dueDays].sort((a, b) => a - b);
  const periodsPerMonth = sortedDays.length;
  const totalPeriods = term * periodsPerMonth;
  const schedule: InstallmentScheduleInput[] = [];
  let allocated = new Decimal(0);

  const dueMonth = firstDueDate.getMonth();
  const dueYear = firstDueDate.getFullYear();

  for (let i = 0; i < totalPeriods; i++) {
    const dayIndex = i % periodsPerMonth;
    const monthOffset = Math.floor(i / periodsPerMonth);
    const targetDay = sortedDays[dayIndex];

    let targetMonth = dueMonth + monthOffset;
    let targetYear = dueYear;
    while (targetMonth > 11) {
      targetMonth -= 12;
      targetYear++;
    }

    const dueDate = makeDueDate(targetYear, targetMonth, targetDay);

    let amount: Decimal;
    if (i === totalPeriods - 1) {
      amount = totalRemainingBalance.minus(allocated);
    } else {
      amount = totalRemainingBalance.div(totalPeriods);
      const rounded = amount.toDecimalPlaces(2);
      allocated = allocated.plus(rounded);
    }

    schedule.push({
      periodNumber: i + 1,
      dueDate,
      amount: amount.toDecimalPlaces(2),
      status: "PENDING",
    });
  }

  return schedule;
}

export function generateAdjustedDates(
  dueDays: number[],
  count: number,
  startDate: Date,
): Date[] {
  const sorted = [...dueDays].sort((a, b) => a - b);
  const perMonth = sorted.length;
  const dates: Date[] = [];
  const startMonth = startDate.getMonth();
  const startYear = startDate.getFullYear();

  for (let i = 0; i < count; i++) {
    const dayIndex = i % perMonth;
    const monthOffset = Math.floor(i / perMonth);
    const targetDay = sorted[dayIndex];

    let targetMonth = startMonth + monthOffset;
    let targetYear = startYear;
    while (targetMonth > 11) {
      targetMonth -= 12;
      targetYear++;
    }

    const safeDay = clampDay(targetYear, targetMonth, targetDay);
    dates.push(new Date(targetYear, targetMonth, safeDay, 0, 0, 0, 0));
  }

  return dates;
}
