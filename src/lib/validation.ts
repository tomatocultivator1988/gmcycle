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
const emailString = z.string().trim().email("Enter a valid email address").optional().or(z.literal(""));

export const createInstallmentAccountSchema = z.object({
  customerName: nameString,
  customerPhone: phoneString,
  customerEmail: emailString,
  customerAddress: requiredString,
  brand: requiredString,
  model: requiredString,
  unitDescription: requiredString,
  cashPrice: moneyString,
  installmentPrice: moneyString.optional(),
  downPayment: moneyString,
  pricingType: z.enum(["FLAT_RATE", "INTEREST_PERCENTAGE"]).default("FLAT_RATE"),
  interestRate: moneyString.optional(),
  term: z.coerce.number().int().min(6, "Minimum term is 6 months").max(24, "Maximum term is 24 months"),
  startDate: dateOnlyString,
}).refine(
  (data) => {
    if (data.pricingType === "FLAT_RATE") {
      return !!data.installmentPrice;
    }
    return true;
  },
  { message: "Installment price is required for flat rate", path: ["installmentPrice"] },
).refine(
  (data) => {
    if (data.pricingType === "INTEREST_PERCENTAGE") {
      return !!data.interestRate && /^\d+(\.\d{1,2})?$/.test(data.interestRate) && Number(data.interestRate) > 0;
    }
    return true;
  },
  { message: "Interest rate is required and must be > 0", path: ["interestRate"] },
);

export const createPaymentSchema = z.object({
  installmentAccountId: requiredString,
  totalAmount: moneyString,
  paymentDate: dateOnlyString,
  method: z.enum(paymentMethods),
  paymentType: z.enum(paymentTypes),
  notes: z.string().optional(),
  cashier: z.string().optional(),
  proofUrl: z.string().optional(),
});

export const updateInstallmentAccountSchema = z.object({
  customerName: nameString,
  customerPhone: phoneString,
  customerEmail: emailString,
  customerAddress: requiredString,
  brand: requiredString,
  model: requiredString,
  unitDescription: requiredString,
});

export const updateAdminConfigSchema = z.object({
  penaltyAmount: moneyString,
  dueDayOptions: z.array(z.number()).min(1, "At least one due day option required"),
});
