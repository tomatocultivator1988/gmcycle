import Decimal from "decimal.js";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { parseDateOnly } from "../src/lib/dates";
import { generateSchedule } from "../src/lib/installment-schedule";
import { decimalToString } from "../src/lib/money";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function createInstallmentAccount(input: {
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  customerAddress: string;
  brand: string;
  model: string;
  unitDescription: string;
  cashPrice: string;
  installmentPrice: string;
  downPayment: string;
  term: number;
  startDate: string;
  status?: "APPLIED" | "ACTIVE";
}) {
  const cashPrice = new Decimal(input.cashPrice);
  const installmentPrice = new Decimal(input.installmentPrice);
  const downPayment = new Decimal(input.downPayment);
  const remainingBalance = installmentPrice.minus(downPayment);
  const monthlyInstallment = remainingBalance.div(input.term).toDecimalPlaces(2);
  const startDate = parseDateOnly(input.startDate);

  const schedule = generateSchedule(startDate, input.term, [15, 30], remainingBalance);
  const firstDueDate = schedule[0]?.dueDate ?? startDate;

  return prisma.installmentAccount.create({
    data: {
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      customerEmail: input.customerEmail ?? null,
      customerAddress: input.customerAddress,
      brand: input.brand,
      model: input.model,
      unitDescription: input.unitDescription,
      cashPrice: decimalToString(cashPrice),
      installmentPrice: decimalToString(installmentPrice),
      downPayment: decimalToString(downPayment),
      remainingBalance: decimalToString(remainingBalance),
      term: input.term,
      monthlyInstallment: decimalToString(monthlyInstallment),
      status: input.status ?? "APPLIED",
      scheduleType: "SEMI_MONTHLY",
      dueDays: [15, 30],
      firstDueDate,
      startDate,
      nextDueDate: firstDueDate,
      schedule: {
        create: schedule.map((s) => ({
          periodNumber: s.periodNumber,
          dueDate: s.dueDate,
          amount: decimalToString(s.amount),
          status: "PENDING",
        })),
      },
    },
  });
}

async function postPayment(input: {
  installmentAccountId: string;
  totalAmount: string;
  paymentDate: string;
  method: "CASH" | "GCASH" | "BANK";
  paymentType: "REGULAR" | "PARTIAL" | "ADVANCE" | "FULL";
  cashier?: string;
  notes?: string;
}) {
  const paymentDate = parseDateOnly(input.paymentDate);

  const account = await prisma.installmentAccount.findUnique({
    where: { id: input.installmentAccountId },
  });

  if (!account) return;

  const createdPayment = await prisma.payment.create({
    data: {
      installmentAccountId: input.installmentAccountId,
      customerName: account.customerName,
      totalAmount: input.totalAmount,
      paymentDate,
      method: input.method,
      paymentType: input.paymentType,
      penaltyAmount: "0.00",
      notes: input.notes ?? null,
      cashier: input.cashier ?? null,
    },
  });

  const totalPaid = await prisma.payment.aggregate({
    where: { installmentAccountId: input.installmentAccountId },
    _sum: { totalAmount: true },
  });

  const fullAccount = await prisma.installmentAccount.findUnique({
    where: { id: input.installmentAccountId },
    include: { schedule: { orderBy: { periodNumber: "asc" } } },
  });

  if (!fullAccount) return;

  const newBalance = new Decimal(fullAccount.installmentPrice)
    .minus(new Decimal(fullAccount.downPayment))
    .minus(totalPaid._sum.totalAmount?.toString() ?? "0")
    .toDecimalPlaces(2);

  const nextUnpaid = fullAccount.schedule.find(
    (s) => s.status === "PENDING" || s.status === "PARTIAL",
  );
  const nextDue = nextUnpaid?.dueDate ?? fullAccount.nextDueDate;

  let status: "ACTIVE" | "FULLY_PAID" | "OVERDUE" | "DUE_TODAY" = "ACTIVE";
  if (newBalance.eq(0)) {
    status = "FULLY_PAID";
  } else {
    const todayStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(paymentDate);
    const dueStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(nextDue);
    if (todayStr > dueStr) status = "OVERDUE";
    else if (todayStr === dueStr) status = "DUE_TODAY";
  }

  await prisma.installmentAccount.update({
    where: { id: input.installmentAccountId },
    data: {
      remainingBalance: decimalToString(newBalance),
      status,
      nextDueDate: nextDue,
    },
  });

  let remainingToApply = new Decimal(input.totalAmount);
  for (const period of fullAccount.schedule) {
    if (remainingToApply.lte(0)) break;
    if (period.status === "PAID" || period.status === "PARTIAL") continue;

    const periodDue = new Decimal(period.amount);
    const paidForPeriod = Decimal.min(remainingToApply, periodDue);

    await prisma.installmentSchedule.update({
      where: { id: period.id },
      data: {
        status: paidForPeriod.gte(periodDue) ? "PAID" : "PARTIAL",
        paidDate: paymentDate,
        paymentId: createdPayment.id,
        paidAmount: decimalToString(paidForPeriod),
      },
    });

    remainingToApply = remainingToApply.minus(paidForPeriod);
  }
}

async function main() {
  await prisma.$transaction([
    prisma.penaltyRecord.deleteMany(),
    prisma.installmentSchedule.deleteMany(),
    prisma.payment.deleteMany(),
    prisma.installmentAccount.deleteMany(),
    prisma.adminConfig.deleteMany(),
  ]);

  await prisma.adminConfig.create({
    data: {
      penaltyPerDay: new Decimal("50.00"),
    },
  });

  console.log("✓ Created admin config");

  // ── ACCOUNT 1: APPLIED ──
  const juan = await createInstallmentAccount({
    customerName: "Juan Dela Cruz",
    customerPhone: "09171234567",
    customerEmail: "juan.delacruz@gmail.com",
    customerAddress: "Barangay San Nicolas, Binan City, Laguna",
    brand: "iPhone",
    model: "16 Pro Max",
    unitDescription: "iPhone 16 Pro Max 256GB, Natural Titanium",
    cashPrice: "80000.00",
    installmentPrice: "96000.00",
    downPayment: "10000.00",
    term: 24,
    startDate: "2026-06-15",
    status: "APPLIED",
  });
  console.log(`✓ Juan Dela Cruz — iPhone 16 Pro Max, APPLIED`);

  // ── ACCOUNT 2: ACTIVE with payments ──
  const maria = await createInstallmentAccount({
    customerName: "Maria Santos",
    customerPhone: "09289876543",
    customerAddress: "Barangay Zulueta, Binan City, Laguna",
    brand: "Samsung",
    model: "Galaxy S25 Ultra",
    unitDescription: "Samsung Galaxy S25 Ultra 512GB, Titanium Silver",
    cashPrice: "65000.00",
    installmentPrice: "78000.00",
    downPayment: "10000.00",
    term: 24,
    startDate: "2026-04-01",
    status: "ACTIVE",
  });
  console.log(`✓ Maria Santos — Galaxy S25 Ultra, ACTIVE`);

  // ── PAYMENTS ──
  console.log("\n— Posting payments —\n");

  const mariaPeriod = new Decimal(maria.monthlyInstallment.toString()).div(2);
  await postPayment({ installmentAccountId: maria.id, totalAmount: decimalToString(mariaPeriod), paymentDate: "2026-05-15", method: "CASH", paymentType: "REGULAR", cashier: "Megan" });
  await postPayment({ installmentAccountId: maria.id, totalAmount: decimalToString(mariaPeriod), paymentDate: "2026-05-30", method: "CASH", paymentType: "REGULAR", cashier: "Megan" });
  await postPayment({ installmentAccountId: maria.id, totalAmount: decimalToString(mariaPeriod), paymentDate: "2026-06-15", method: "GCASH", paymentType: "REGULAR", cashier: "Megan" });
  console.log(`✓ Maria: 3 period payments`);

  // ── SUMMARY ──
  console.log("\n═══════════════════════════════════════");
  console.log("  SEED COMPLETE");
  console.log("═══════════════════════════════════════\n");

  console.log("2 accounts created:");
  console.log("  1. Juan Dela Cruz — iPhone 16 Pro Max — APPLIED (needs requirements)");
  console.log("  2. Maria Santos — Galaxy S25 Ultra — ACTIVE (with 3 payments)\n");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
