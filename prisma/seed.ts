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
  customerAddress: string;

  brand: string;
  model: string;
  unitDescription: string;
  cashPrice: string;
  installmentPrice: string;
  downPayment: string;
  term: number;
  startDate: string;
  dueDayOfMonth: number;
}) {
  const cashPrice = new Decimal(input.cashPrice);
  const installmentPrice = new Decimal(input.installmentPrice);
  const downPayment = new Decimal(input.downPayment);
  const remainingBalance = installmentPrice.minus(downPayment);
  const monthlyInstallment = remainingBalance.div(input.term).toDecimalPlaces(2);
  const startDate = parseDateOnly(input.startDate);

  const firstDueDate = new Date(
    startDate.getFullYear(),
    startDate.getMonth() + 1,
    Math.min(
      input.dueDayOfMonth,
      new Date(startDate.getFullYear(), startDate.getMonth() + 2, 0).getDate(),
    ),
  );

  const schedule = generateSchedule(
    startDate,
    input.dueDayOfMonth,
    input.term,
    monthlyInstallment,
    remainingBalance,
  );

  return prisma.installmentAccount.create({
    data: {
      customerName: input.customerName,
      customerPhone: input.customerPhone,
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
      status: "ACTIVE",
      startDate,
      dueDayOfMonth: input.dueDayOfMonth,
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
  penaltyAmount?: string;
  discountAmount?: string;
  cashier?: string;
}) {
  const paymentDate = parseDateOnly(input.paymentDate);
  const penaltyAmount = input.penaltyAmount ?? "0.00";
  const discountAmount = input.discountAmount ?? "0.00";

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
      penaltyAmount,
      discountAmount,
      cashier: input.cashier ?? null,
    },
  });

  if (new Decimal(penaltyAmount).gt(0)) {
    await prisma.penaltyRecord.create({
      data: {
        installmentAccountId: input.installmentAccountId,
        paymentId: createdPayment.id,
        amount: penaltyAmount,
        appliedDate: paymentDate,
        reason: `Late payment (${input.paymentDate} past due ${new Intl.DateTimeFormat("en-CA").format(account.nextDueDate)})`,
      },
    });
  }

  if (new Decimal(discountAmount).gt(0)) {
    await prisma.discountRecord.create({
      data: {
        installmentAccountId: input.installmentAccountId,
        paymentId: createdPayment.id,
        amount: discountAmount,
        appliedDate: paymentDate,
        reason: "Advance payment discount",
      },
    });
  }

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
        penaltyAmount,
        discountAmount,
      },
    });

    remainingToApply = remainingToApply.minus(paidForPeriod);
  }
}

async function main() {
  await prisma.$transaction([
    prisma.discountRecord.deleteMany(),
    prisma.penaltyRecord.deleteMany(),
    prisma.installmentSchedule.deleteMany(),
    prisma.payment.deleteMany(),
    prisma.installmentAccount.deleteMany(),
    prisma.adminConfig.deleteMany(),
  ]);

  await prisma.adminConfig.create({
    data: {
      penaltyAmount: new Decimal("200.00"),
      discountAmount: new Decimal("200.00"),
      dueDayOptions: [10, 20, 30],
    },
  });

  console.log("Created admin config");

  const juanAccount = await createInstallmentAccount({
    customerName: "Juan Dela Cruz",
    customerPhone: "09171234567",
    customerAddress: "Barangay San Nicolas, Cabanatuan City, Nueva Ecija",

    brand: "Honda",
    model: "Beat",
    unitDescription: "Honda Beat 2024, Red, 110cc",
    cashPrice: "80000.00",
    installmentPrice: "96000.00",
    downPayment: "10000.00",
    term: 24,
    startDate: "2026-01-15",
    dueDayOfMonth: 20,
  });

  console.log(`Created account for Juan Dela Cruz: Honda Beat, ₱86,000 balance, 24 months`);

  const mariaAccount = await createInstallmentAccount({
    customerName: "Maria Santos",
    customerPhone: "09289876543",
    customerAddress: "Barangay Zulueta, Cabanatuan City, Nueva Ecija",

    brand: "Yamaha",
    model: "Mio",
    unitDescription: "Yamaha Mio i 125 2024, Blue, 125cc",
    cashPrice: "90000.00",
    installmentPrice: "115200.00",
    downPayment: "15000.00",
    term: 36,
    startDate: "2026-02-01",
    dueDayOfMonth: 10,
  });

  console.log(`Created account for Maria Santos: Yamaha Mio, ₱100,200 balance, 36 months`);

  const pedroAccount = await createInstallmentAccount({
    customerName: "Pedro Reyes",
    customerPhone: "09361234589",
    customerAddress: "Barangay Sangitan East, Cabanatuan City, Nueva Ecija",

    brand: "Suzuki",
    model: "Raider 150",
    unitDescription: "Suzuki Raider 150 2024, Black, 150cc",
    cashPrice: "110000.00",
    installmentPrice: "125000.00",
    downPayment: "20000.00",
    term: 12,
    startDate: "2026-03-01",
    dueDayOfMonth: 30,
  });

  console.log(`Created account for Pedro Reyes: Suzuki Raider, ₱105,000 balance, 12 months`);

  // Post on-time payment for Juan (due 20th, paid 18th) - gets discount
  const juanMonthly = new Decimal(juanAccount.monthlyInstallment.toString());
  await postPayment({
    installmentAccountId: juanAccount.id,
    totalAmount: decimalToString(juanMonthly),
    paymentDate: "2026-02-18",
    method: "CASH",
    paymentType: "REGULAR",
    discountAmount: "200.00",
    cashier: "Admin",
  });

  // Post late payment for Juan (due 20th, paid 28th) - gets penalty
  await postPayment({
    installmentAccountId: juanAccount.id,
    totalAmount: decimalToString(juanMonthly),
    paymentDate: "2026-03-28",
    method: "CASH",
    paymentType: "REGULAR",
    penaltyAmount: "200.00",
    cashier: "Admin",
  });

  // Post advance payment for Maria (due 10th, paid 5th) - gets discount
  const mariaMonthly = new Decimal(mariaAccount.monthlyInstallment.toString());
  await postPayment({
    installmentAccountId: mariaAccount.id,
    totalAmount: decimalToString(mariaMonthly.times(2)),
    paymentDate: "2026-03-05",
    method: "GCASH",
    paymentType: "ADVANCE",
    discountAmount: "200.00",
    cashier: "Admin",
  });

  // Full payment for Pedro
  const pedroBalance = new Decimal(pedroAccount.installmentPrice.toString())
    .minus(new Decimal(pedroAccount.downPayment.toString()));
  await postPayment({
    installmentAccountId: pedroAccount.id,
    totalAmount: decimalToString(pedroBalance),
    paymentDate: "2026-04-15",
    method: "BANK",
    paymentType: "FULL",
    cashier: "Admin",
  });

  console.log("Seed completed successfully!");
  console.log("  - Juan Dela Cruz: Honda Beat, 2 payments (1 on-time discount, 1 late penalty)");
  console.log("  - Maria Santos: Yamaha Mio, 1 advance payment with discount");
  console.log("  - Pedro Reyes: Suzuki Raider, fully paid");
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
