import { z } from "zod";

export const paymentMethods = ["CASH", "GCASH", "BANK"] as const;
export const paymentTypes = ["REGULAR", "PARTIAL", "ADVANCE", "FULL"] as const;

const requiredString = z.string().trim().min(1, "Required field");
const moneyString = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,2})?$/, "Enter a valid amount");
const dateOnlyString = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD format");
const phoneString = z
  .string()
  .trim()
  .regex(/^\d{7,15}$/, "Phone must contain 7 to 15 digits only");
const nameString = z
  .string()
  .trim()
  .min(2, "Name is too short")
  .max(120, "Name is too long")
  .regex(/^[\p{L}][\p{L}\s.'-]*$/u, "Name contains unsupported characters");
export const createInstallmentAccountSchema = z.object({
  customerName: nameString,
  customerPhone: phoneString,
  customerAddress: requiredString,
  brand: requiredString,
  model: requiredString,
  unitDescription: requiredString,
  cashPrice: moneyString,
  installmentPrice: moneyString,
  downPayment: moneyString,
  term: z.coerce.number().refine((val) => [12, 24, 36, 48].includes(val), "Term must be 12, 24, 36, or 48 months"),
  startDate: dateOnlyString,
  dueDayOfMonth: z.coerce.number().refine((val) => [10, 20, 30].includes(val), "Due day must be 10, 20, or 30"),
});

export const createPaymentSchema = z.object({
  installmentAccountId: requiredString,
  totalAmount: moneyString,
  paymentDate: dateOnlyString,
  method: z.enum(paymentMethods),
  paymentType: z.enum(paymentTypes),
  notes: z.string().optional(),
  cashier: z.string().optional(),
});

export const updateAdminConfigSchema = z.object({
  penaltyAmount: moneyString,
  discountAmount: moneyString,
  dueDayOptions: z.array(z.number()).min(1, "At least one due day option required"),
});
