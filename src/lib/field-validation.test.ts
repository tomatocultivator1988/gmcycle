import { describe, expect, it } from "vitest";
import {
  isValidIdNumber,
  isValidMoney,
  isValidName,
  isValidPhone,
  isValidTitle,
  normalizeMoneyForSubmit,
  sanitizeDigits,
  sanitizeIdNumber,
  sanitizeMoneyInput,
  sanitizeName,
  sanitizeTitle,
} from "./field-validation";

describe("field validation", () => {
  it("keeps names letter-based and removes digits", () => {
    expect(sanitizeName("Ana 123 Santos")).toBe("Ana Santos");
    expect(isValidName("Ana Santos")).toBe(true);
    expect(isValidName("Ana 123")).toBe(false);
  });

  it("keeps phone numbers numeric only", () => {
    expect(sanitizeDigits("+63 917-555-0101")).toBe("639175550101");
    expect(isValidPhone("09175550101")).toBe(true);
    expect(isValidPhone("0917ABC0101")).toBe(false);
  });

  it("normalizes ID numbers to approved characters", () => {
    expect(sanitizeIdNumber(" id a-001 ! ")).toBe("IDA-001");
    expect(isValidIdNumber("IDA-001")).toBe(true);
    expect(isValidIdNumber("ID A 001")).toBe(false);
  });

  it("allows practical account titles and rejects unsupported symbols", () => {
    expect(sanitizeTitle("Appliance Loan #1")).toBe("Appliance Loan 1");
    expect(isValidTitle("Appliance Loan 1")).toBe(true);
    expect(isValidTitle("Appliance Loan @ Counter")).toBe(false);
  });

  it("sanitizes and validates money without using floating point", () => {
    expect(sanitizeMoneyInput("PHP 0012.345")).toBe("12.34");
    expect(sanitizeMoneyInput(".5")).toBe("0.5");
    expect(normalizeMoneyForSubmit("12.3")).toBe("12.30");
    expect(normalizeMoneyForSubmit("12.")).toBe("12.00");
    expect(isValidMoney("12.30")).toBe(true);
    expect(isValidMoney("0.00")).toBe(false);
    expect(isValidMoney("12.345")).toBe(false);
  });
});
