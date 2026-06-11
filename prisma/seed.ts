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
  interestRate?: string;
  startDate: string;
  status?: "APPLIED" | "ACTIVE";
  scheduleType?: "MONTHLY" | "SEMI_MONTHLY";
  dueDays?: number[];
}) {
  const cashPrice = new Decimal(input.cashPrice);
  const installmentPrice = new Decimal(input.installmentPrice);
  const downPayment = new Decimal(input.downPayment);
  const remainingBalance = installmentPrice.minus(downPayment);
  const monthlyInstallment = remainingBalance.div(input.term).toDecimalPlaces(2);
  const startDate = parseDateOnly(input.startDate);
  const dueDays = input.dueDays ?? (input.scheduleType === "MONTHLY" ? [15] : [15, 30]);
  const scheduleType = input.scheduleType ?? "SEMI_MONTHLY";

  const schedule = generateSchedule(startDate, input.term, dueDays, remainingBalance);
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
      interestRate: input.interestRate ?? null,
      status: input.status ?? "APPLIED",
      scheduleType,
      dueDays,
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

  // ── 1. APPLIED ──
  await createInstallmentAccount({
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
    scheduleType: "SEMI_MONTHLY",
    dueDays: [1, 16],
  });
  console.log("✓ 1. Juan Dela Cruz — APPLIED");

  // ── 2–8. ACTIVE (semi-monthly, diverse due pair) ──
  const activesSM: { name: string; phone: string; address: string; brand: string; model: string; cash: string; installment: string; dp: string; term: number; start: string; days: number[] }[] = [
    { name: "Maria Santos", phone: "09289876543", address: "Barangay Zulueta, Binan City, Laguna", brand: "Samsung", model: "Galaxy S25 Ultra", cash: "65000.00", installment: "78000.00", dp: "10000.00", term: 24, start: "2026-04-01", days: [5, 20] },
    { name: "Pedro Reyes", phone: "09551234567", address: "Barangay San Jose, Binan City, Laguna", brand: "Honda", model: "Click 125i", cash: "85000.00", installment: "102000.00", dp: "15000.00", term: 24, start: "2026-05-01", days: [7, 22] },
    { name: "Lina Mercado", phone: "09661234567", address: "Barangay San Isidro, Binan City, Laguna", brand: "Toyota", model: "Raize E CVT", cash: "751000.00", installment: "901200.00", dp: "100000.00", term: 36, start: "2026-05-15", days: [10, 25] },
    { name: "Josefa Villanueva", phone: "09771234567", address: "Barangay San Vicente, Binan City, Laguna", brand: "Yamaha", model: "Nmax", cash: "120000.00", installment: "144000.00", dp: "20000.00", term: 24, start: "2026-05-01", days: [12, 28] },
    { name: "Ramon Bautista", phone: "09881234567", address: "Barangay Santo Domingo, Binan City, Laguna", brand: "Suzuki", model: "Raider J Crossover", cash: "95000.00", installment: "114000.00", dp: "15000.00", term: 24, start: "2026-04-15", days: [14, 30] },
    { name: "Cecilia Tan", phone: "09991234567", address: "Barangay San Lorenzo, Binan City, Laguna", brand: "Kawasaki", model: "Barako 175", cash: "78000.00", installment: "93600.00", dp: "12000.00", term: 24, start: "2026-05-15", days: [2, 18] },
    { name: "Nestor Santos", phone: "09101234567", address: "Barangay San Antonio, Binan City, Laguna", brand: "BMW", model: "G 310 R", cash: "200000.00", installment: "240000.00", dp: "30000.00", term: 36, start: "2026-06-01", days: [9, 24] },
  ];

  for (const a of activesSM) {
    await createInstallmentAccount({
      customerName: a.name,
      customerPhone: a.phone,
      customerAddress: a.address,
      brand: a.brand,
      model: a.model,
      unitDescription: `${a.brand} ${a.model}`,
      cashPrice: a.cash,
      installmentPrice: a.installment,
      downPayment: a.dp,
      term: a.term,
      startDate: a.start,
      status: "ACTIVE",
      scheduleType: "SEMI_MONTHLY",
      dueDays: a.days,
    });
  }
  console.log("✓ 2–8. Active semi-monthly (diverse due pairs)");

  // ── 9–12. ACTIVE (monthly, diverse due days) ──
  const activesM: { name: string; phone: string; address: string; brand: string; model: string; cash: string; installment: string; dp: string; term: number; start: string; day: number }[] = [
    { name: "Diana Flores", phone: "09111111111", address: "Barangay San Francisco, Binan City, Laguna", brand: "Honda", model: "Beat", cash: "72000.00", installment: "86400.00", dp: "10000.00", term: 24, start: "2026-04-01", day: 8 },
    { name: "Gregorio Lim", phone: "09222222222", address: "Barangay San Jose, Binan City, Laguna", brand: "Yamaha", model: "Mio i125", cash: "68000.00", installment: "81600.00", dp: "10000.00", term: 24, start: "2026-04-15", day: 13 },
    { name: "Fely Gomez", phone: "09333333333", address: "Barangay San Isidro, Binan City, Laguna", brand: "Suzuki", model: "Smash 115", cash: "55000.00", installment: "66000.00", dp: "8000.00", term: 18, start: "2026-05-01", day: 21 },
    { name: "Mario Reyes", phone: "09444444444", address: "Barangay San Vicente, Binan City, Laguna", brand: "Kawasaki", model: "CT 100", cash: "50000.00", installment: "60000.00", dp: "8000.00", term: 18, start: "2026-05-15", day: 26 },
  ];

  for (const a of activesM) {
    await createInstallmentAccount({
      customerName: a.name,
      customerPhone: a.phone,
      customerAddress: a.address,
      brand: a.brand,
      model: a.model,
      unitDescription: `${a.brand} ${a.model}`,
      cashPrice: a.cash,
      installmentPrice: a.installment,
      downPayment: a.dp,
      term: a.term,
      startDate: a.start,
      status: "ACTIVE",
      scheduleType: "MONTHLY",
      dueDays: [a.day],
    });
  }
  console.log("✓ 9–12. Active monthly (diverse due days)");

  // ── 13. OVERDUE (semi-monthly, due 3+18) ──
  const carlos = await createInstallmentAccount({
    customerName: "Carlos Cruz",
    customerPhone: "09361234567",
    customerAddress: "Barangay San Antonio, Binan City, Laguna",
    brand: "Xiaomi",
    model: "Redmi Note 14 Pro",
    unitDescription: "Xiaomi Redmi Note 14 Pro 256GB, Midnight Black",
    cashPrice: "30000.00",
    installmentPrice: "36000.00",
    downPayment: "5000.00",
    term: 12,
    startDate: "2026-03-01",
    status: "ACTIVE",
    scheduleType: "SEMI_MONTHLY",
    dueDays: [3, 18],
  });

  const carlosPeriod = new Decimal(carlos.monthlyInstallment.toString()).div(2);
  await postPayment({ installmentAccountId: carlos.id, totalAmount: decimalToString(carlosPeriod), paymentDate: "2026-03-03", method: "CASH", paymentType: "REGULAR", cashier: "Megan" });
  await postPayment({ installmentAccountId: carlos.id, totalAmount: decimalToString(carlosPeriod), paymentDate: "2026-03-18", method: "CASH", paymentType: "REGULAR", cashier: "Megan" });
  await prisma.installmentSchedule.updateMany({
    where: { installmentAccountId: carlos.id, status: "PENDING", dueDate: { lt: new Date() } },
    data: { status: "OVERDUE" },
  });
  await prisma.installmentAccount.update({
    where: { id: carlos.id },
    data: { status: "OVERDUE", nextDueDate: new Date("2026-04-03T00:00:00+08:00") },
  });
  console.log("✓ 13. Carlos Cruz — OVERDUE (semi-monthly, due 3+18)");

  // ── 14. OVERDUE (semi-monthly, due 8+23) ──
  const ana = await createInstallmentAccount({
    customerName: "Ana Lopez",
    customerPhone: "09459876543",
    customerAddress: "Barangay San Francisco, Binan City, Laguna",
    brand: "Oppo",
    model: "Find X8",
    unitDescription: "Oppo Find X8 512GB, Pearl White",
    cashPrice: "45000.00",
    installmentPrice: "54000.00",
    downPayment: "8000.00",
    term: 18,
    startDate: "2026-03-15",
    status: "ACTIVE",
    scheduleType: "SEMI_MONTHLY",
    dueDays: [8, 23],
  });

  const anaPeriod = new Decimal(ana.monthlyInstallment.toString()).div(2);
  await postPayment({ installmentAccountId: ana.id, totalAmount: decimalToString(anaPeriod), paymentDate: "2026-04-08", method: "CASH", paymentType: "REGULAR", cashier: "Megan" });
  await prisma.installmentSchedule.updateMany({
    where: { installmentAccountId: ana.id, status: "PENDING", dueDate: { lt: new Date() } },
    data: { status: "OVERDUE" },
  });
  await prisma.installmentAccount.update({
    where: { id: ana.id },
    data: { status: "OVERDUE", nextDueDate: new Date("2026-04-23T00:00:00+08:00") },
  });
  console.log("✓ 14. Ana Lopez — OVERDUE (semi-monthly, due 8+23)");

  // ── 15. OVERDUE (monthly, due 14) ──
  const tomas = await createInstallmentAccount({
    customerName: "Tomas Rivera",
    customerPhone: "09555555555",
    customerAddress: "Barangay San Juan, Binan City, Laguna",
    brand: "Honda",
    model: "Click 160",
    unitDescription: "Honda Click 160",
    cashPrice: "95000.00",
    installmentPrice: "114000.00",
    downPayment: "15000.00",
    term: 18,
    startDate: "2026-03-01",
    status: "ACTIVE",
    scheduleType: "MONTHLY",
    dueDays: [14],
  });

  const tomasPeriod = new Decimal(tomas.monthlyInstallment.toString());
  await postPayment({ installmentAccountId: tomas.id, totalAmount: decimalToString(tomasPeriod), paymentDate: "2026-03-14", method: "CASH", paymentType: "REGULAR", cashier: "Megan" });
  await prisma.installmentSchedule.updateMany({
    where: { installmentAccountId: tomas.id, status: "PENDING", dueDate: { lt: new Date() } },
    data: { status: "OVERDUE" },
  });
  await prisma.installmentAccount.update({
    where: { id: tomas.id },
    data: { status: "OVERDUE", nextDueDate: new Date("2026-04-14T00:00:00+08:00") },
  });
  console.log("✓ 15. Tomas Rivera — OVERDUE (monthly, due 14)");

  // ── STATUS RECONCILIATION ──
  console.log("\n— Reconciling account statuses —\n");
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());
  const todayStart = new Date(`${today}T00:00:00+08:00`);
  const allActive = await prisma.installmentAccount.findMany({
    where: { status: { in: ["ACTIVE", "DUE_TODAY"] } },
  });
  let reconciled = 0;
  for (const acct of allActive) {
    const dueDate = new Date(acct.nextDueDate);
    const isOverdue = dueDate < todayStart && new Decimal(acct.remainingBalance).gt(0);
    if (isOverdue) {
      await prisma.installmentAccount.update({
        where: { id: acct.id },
        data: { status: "OVERDUE" },
      });
      await prisma.installmentSchedule.updateMany({
        where: { installmentAccountId: acct.id, status: "PENDING", dueDate: { lt: todayStart } },
        data: { status: "OVERDUE" },
      });
      reconciled++;
    }
  }
  console.log(`✓ Reconciled ${reconciled} accounts → OVERDUE`);

  // ── SUMMARY ──
  console.log("\n═══════════════════════════════════════");
  console.log("  SEED COMPLETE");
  console.log("═══════════════════════════════════════\n");

  console.log("15 accounts created:");
  console.log("   1. Juan Dela Cruz — APPLIED (due 1+16)");
  console.log("   2. Maria Santos — ACTIVE (due 5+20)");
  console.log("   3. Pedro Reyes — ACTIVE (due 7+22)");
  console.log("   4. Lina Mercado — ACTIVE (due 10+25)");
  console.log("   5. Josefa Villanueva — ACTIVE (due 12+28)");
  console.log("   6. Ramon Bautista — ACTIVE (due 14+30)");
  console.log("   7. Cecilia Tan — ACTIVE (due 2+18)");
  console.log("   8. Nestor Santos — ACTIVE (due 9+24)");
  console.log("   9. Diana Flores — ACTIVE (monthly, due 8)");
  console.log("  10. Gregorio Lim — ACTIVE (monthly, due 13)");
  console.log("  11. Fely Gomez — ACTIVE (monthly, due 21)");
  console.log("  12. Mario Reyes — ACTIVE (monthly, due 26)");
  console.log("  13. Carlos Cruz — OVERDUE (semi-monthly, due 3+18)");
  console.log("  14. Ana Lopez — OVERDUE (semi-monthly, due 8+23)");
  console.log("  15. Tomas Rivera — OVERDUE (monthly, due 14)\n");
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
