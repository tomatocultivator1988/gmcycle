import Decimal from "decimal.js";
import { dateToManilaDateOnly } from "@/lib/dates";

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

export function findClosestIndex(sorted: number[], target: number): number {
  const exact = sorted.indexOf(target);
  if (exact >= 0) return exact;
  let best = 0;
  let bestDist = Math.abs(sorted[0] - target);
  for (let i = 1; i < sorted.length; i++) {
    const dist = Math.abs(sorted[i] - target);
    if (dist < bestDist) { bestDist = dist; best = i; }
  }
  return best;
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
  roundStep = 1,
): InstallmentScheduleInput[] {
  const sortedDays = [...dueDays].sort((a, b) => a - b);
  const periodsPerMonth = sortedDays.length;
  const totalPeriods = term * periodsPerMonth;
  const schedule: InstallmentScheduleInput[] = [];
  let allocated = new Decimal(0);

  const dueMonth = firstDueDate.getMonth();
  const dueYear = firstDueDate.getFullYear();
  const startDay = parseInt(dateToManilaDateOnly(firstDueDate).slice(8, 10), 10);
  const startIdx = findClosestIndex(sortedDays, startDay);

  for (let i = 0; i < totalPeriods; i++) {
    const adjustedI = startIdx + i;
    const dayIndex = adjustedI % periodsPerMonth;
    const monthOffset = Math.floor(adjustedI / periodsPerMonth);
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
      const rounded = roundStep > 1
        ? amount.div(roundStep).floor().times(roundStep).toDecimalPlaces(2)
        : amount.toDecimalPlaces(2);
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

  const startDay = parseInt(dateToManilaDateOnly(startDate).slice(8, 10), 10);
  const startIdx = findClosestIndex(sorted, startDay);

  for (let i = 0; i < count; i++) {
    const adjustedI = startIdx + i;
    const dayIndex = adjustedI % perMonth;
    const monthOffset = Math.floor(adjustedI / perMonth);
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
