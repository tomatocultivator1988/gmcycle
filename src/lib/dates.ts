export const MANILA_TIME_ZONE = "Asia/Manila";

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MANILA_OFFSET = "+08:00";
const DAY_MS = 24 * 60 * 60 * 1000;

function formatDateParts(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: MANILA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  return `${year}-${month}-${day}`;
}

export function getManilaTodayDateString(now = new Date()): string {
  return formatDateParts(now);
}

export function parseDateOnly(value: unknown, field = "date"): Date {
  if (typeof value !== "string" || !DATE_ONLY_PATTERN.test(value)) {
    throw new Error(`${field} must use YYYY-MM-DD format`);
  }

  const date = new Date(`${value}T00:00:00.000${MANILA_OFFSET}`);

  if (Number.isNaN(date.getTime()) || formatDateParts(date) !== value) {
    throw new Error(`${field} is not a valid calendar date`);
  }

  return date;
}

export function dateToManilaDateOnly(date: Date | null | undefined): string {
  if (!date) return "";
  return formatDateParts(date);
}

export function isBeforeManilaToday(date: Date, now = new Date()): boolean {
  return dateToManilaDateOnly(date) < getManilaTodayDateString(now);
}

export function getManilaDayRange(now = new Date()): { start: Date; end: Date } {
  const today = getManilaTodayDateString(now);
  const start = parseDateOnly(today, "today");
  const end = new Date(start.getTime() + DAY_MS);

  return { start, end };
}
