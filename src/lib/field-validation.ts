import Decimal from "decimal.js";

export const NAME_PATTERN = /^[\p{L}][\p{L}\s.'-]*$/u;
export const PHONE_PATTERN = /^\d{7,15}$/;
export const ID_NUMBER_PATTERN = /^[A-Za-z0-9-]{3,32}$/;
export const TITLE_PATTERN = /^[\p{L}0-9][\p{L}0-9\s.,'()/-]*$/u;
export const MONEY_PATTERN = /^\d+(\.\d{1,2})?$/;

export function sanitizeDigits(value: string): string {
  return value.replace(/\D/g, "");
}

export function sanitizeIdNumber(value: string): string {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "")
    .replace(/-{2,}/g, "-");
}

export function sanitizeName(value: string): string {
  return value
    .replace(/[^\p{L}\s.'-]/gu, "")
    .replace(/\s{2,}/g, " ");
}

export function sanitizeTitle(value: string): string {
  return value
    .replace(/[^\p{L}0-9\s.,'()/-]/gu, "")
    .replace(/\s{2,}/g, " ");
}

export function sanitizeMoneyInput(value: string): string {
  const cleaned = value.replace(/[^\d.]/g, "");
  const [whole = "", ...decimalParts] = cleaned.split(".");
  const decimals = decimalParts.join("").slice(0, 2);
  const normalizedWhole = whole.replace(/^0+(?=\d)/, "");

  if (cleaned.includes(".")) {
    return `${normalizedWhole || "0"}.${decimals}`;
  }

  return normalizedWhole;
}

export function normalizeMoneyForSubmit(value: string): string {
  let trimmed = value.trim();

  if (/^\d+\.$/.test(trimmed)) {
    trimmed = `${trimmed}00`;
  }

  if (!MONEY_PATTERN.test(trimmed)) {
    return trimmed;
  }

  return new Decimal(trimmed).toFixed(2);
}

export function isValidRequiredText(value: string): boolean {
  return value.trim().length > 0;
}

export function isValidName(value: string): boolean {
  const trimmed = value.trim();

  return trimmed.length >= 2 && trimmed.length <= 120 && NAME_PATTERN.test(trimmed);
}

export function isValidPhone(value: string): boolean {
  return PHONE_PATTERN.test(value.trim());
}

export function isValidIdNumber(value: string): boolean {
  return ID_NUMBER_PATTERN.test(value.trim());
}

export function isValidTitle(value: string): boolean {
  const trimmed = value.trim();

  return trimmed.length >= 2 && trimmed.length <= 120 && TITLE_PATTERN.test(trimmed);
}

export function isValidMoney(value: string, options: { allowZero?: boolean } = {}): boolean {
  const trimmed = value.trim();

  if (!MONEY_PATTERN.test(trimmed)) {
    return false;
  }

  let amount: Decimal;

  try {
    amount = new Decimal(trimmed);
  } catch {
    return false;
  }

  return options.allowZero ? amount.gte(0) : amount.gt(0);
}
