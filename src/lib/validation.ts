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
  fbLink: z.string().url("Enter a valid URL").optional().or(z.literal("")),
  brand: requiredString,
  model: requiredString,
  unitDescription: requiredString,
  itemType: z.enum(["GADGET", "CASH"]).default("GADGET"),
  cashPrice: moneyString,
  downPayment: moneyString,
  processingFee: moneyString.optional(),
  interestRate: moneyString,
  term: z.coerce.number().int().min(6, "Minimum term is 6 months").max(48, "Maximum term is 48 months"),
  startDate: dateOnlyString.optional(),
  scheduleType: z.enum(["SEMI_MONTHLY", "MONTHLY"]).default("SEMI_MONTHLY"),
  dueDays: z.array(z.number().int().min(1).max(31)).min(1, "At least one due day required"),
  firstDueDate: dateOnlyString,
  dateGiven: dateOnlyString.optional(),
  customFields: z.record(z.string(), z.string()).optional(),
});

export const createPaymentSchema = z.object({
  installmentAccountId: requiredString,
  totalAmount: moneyString,
  paymentDate: dateOnlyString,
  method: z.enum(paymentMethods),
  paymentType: z.enum(paymentTypes).optional(),
  notes: z.string().optional(),
  cashier: z.string().optional(),
  proofUrl: z.string().optional(),
});

export const updateInstallmentAccountSchema = z.object({
  customerName: nameString,
  customerPhone: phoneString,
  customerEmail: emailString,
  customerAddress: requiredString,
  fbLink: z.string().url("Enter a valid URL").optional().or(z.literal("")),
  brand: requiredString,
  model: requiredString,
  unitDescription: requiredString,
  itemType: z.enum(["GADGET", "CASH"]).optional(),
  processingFee: moneyString.optional(),
  customFields: z.record(z.string(), z.string()).optional(),
});

export const updateAdminConfigSchema = z.object({
  penaltyPerDay: moneyString,
  adminEmail: z.string().email("Enter a valid email").optional().or(z.literal("")),
  adminPassword: z.string().optional(),
});

export const markBadRecordSchema = z.object({
  badRecord: z.boolean(),
  badRecordRemark: z.string().optional(),
});

export const closeAccountSchema = z.object({
  remarks: z.string().min(1, "Remarks are required"),
  password: z.string().min(1, "Admin password is required"),
});

export const deviceSecuritySchema = z.object({
  deviceEmail: z.string().email("Enter a valid email"),
  deviceEmailPassword: z.string().min(1, "Password is required"),
  deviceAccountHolderEmail: z.string().email("Enter a valid email"),
});
