import Decimal from "decimal.js";
import { MONEY_PATTERN } from "./field-validation";

export type MoneyInput = string | Decimal;

export function parseMoney(value: unknown, field = "amount"): Decimal {
  if (value instanceof Decimal) {
    return value.toDecimalPlaces(2);
  }

  if (typeof value !== "string" || !MONEY_PATTERN.test(value.trim())) {
    throw new Error(`${field} must be a valid amount`);
  }

  return new Decimal(value.trim()).toDecimalPlaces(2);
}

export function parsePositiveMoney(value: unknown, field = "amount"): Decimal {
  const amount = parseMoney(value, field);

  if (amount.lte(0)) {
    throw new Error(`${field} must be greater than 0`);
  }

  return amount;
}

export function decimalToString(value: MoneyInput): string {
  return new Decimal(value.toString()).toFixed(2);
}

export function formatPeso(value: MoneyInput): string {
  const [whole, cents] = decimalToString(value).split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  return `₱${grouped}.${cents}`;
}

export function roundTo(value: MoneyInput, step: number): Decimal {
  if (step <= 1) return new Decimal(value.toString()).toDecimalPlaces(2);
  const d = new Decimal(value.toString());
  return d.div(step).round().times(step).toDecimalPlaces(2);
}
