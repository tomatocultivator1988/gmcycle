import Decimal from "decimal.js";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { parseDateOnly } from "../src/lib/dates";
import { generateSchedule } from "../src/lib/installment-schedule";
import { decimalToString, formatPeso } from "../src/lib/money";

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
  notes?: string;
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
      notes: input.notes ?? null,
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
        reason: `Late payment — ${new Intl.DateTimeFormat("en-CA").format(account.nextDueDate)} due, paid ${input.paymentDate}`,
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
        reason: "Advance/early payment discount",
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

  console.log("✓ Created admin config");

  // ── ACCOUNTS ──────────────────────────────────────────

  // 1. Juan Dela Cruz — Honda Beat, ACTIVE, on-time payer
  const juan = await createInstallmentAccount({
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
  console.log(`✓ Juan Dela Cruz — Honda Beat, ₱86,000, 24mo`);

  // 2. Maria Santos — Yamaha Mio, ACTIVE, advance payer
  const maria = await createInstallmentAccount({
    customerName: "Maria Santos",
    customerPhone: "09289876543",
    customerAddress: "Barangay Zulueta, Cabanatuan City, Nueva Ecija",
    brand: "Yamaha",
    model: "Mio i 125",
    unitDescription: "Yamaha Mio i 125 2024, Blue, 125cc",
    cashPrice: "90000.00",
    installmentPrice: "115200.00",
    downPayment: "15000.00",
    term: 36,
    startDate: "2026-02-01",
    dueDayOfMonth: 10,
  });
  console.log(`✓ Maria Santos — Yamaha Mio, ₱100,200, 36mo`);

  // 3. Pedro Reyes — Suzuki Raider, FULLY PAID
  const pedro = await createInstallmentAccount({
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
  console.log(`✓ Pedro Reyes — Suzuki Raider, ₱105,000, 12mo`);

  // 4. Ana Gonzales — Honda Click, OVERDUE (no payments, past due)
  const ana = await createInstallmentAccount({
    customerName: "Ana Gonzales",
    customerPhone: "09451237890",
    customerAddress: "Barangay Aduas Centro, Cabanatuan City, Nueva Ecija",
    brand: "Honda",
    model: "Click 150",
    unitDescription: "Honda Click 150 2025, White, 150cc",
    cashPrice: "95000.00",
    installmentPrice: "118000.00",
    downPayment: "18000.00",
    term: 24,
    startDate: "2026-01-05",
    dueDayOfMonth: 10,
  });
  console.log(`✓ Ana Gonzales — Honda Click, ₱100,000, 24mo`);

  // 5. Jose Mercado — Kawasaki Barako, ACTIVE, partial payer
  const jose = await createInstallmentAccount({
    customerName: "Jose Mercado",
    customerPhone: "09159876543",
    customerAddress: "Barangay Bakod Bayan, Cabanatuan City, Nueva Ecija",
    brand: "Kawasaki",
    model: "Barako 175",
    unitDescription: "Kawasaki Barako 175 2023, Green, 175cc",
    cashPrice: "75000.00",
    installmentPrice: "92000.00",
    downPayment: "12000.00",
    term: 24,
    startDate: "2025-11-01",
    dueDayOfMonth: 20,
  });
  console.log(`✓ Jose Mercado — Kawasaki Barako, ₱80,000, 24mo`);

  // 6. Luzviminda Reyes — Yamaha NMAX, ACTIVE, new account
  const luz = await createInstallmentAccount({
    customerName: "Luzviminda Reyes",
    customerPhone: "09774561234",
    customerAddress: "Barangay Dimasalang, Cabanatuan City, Nueva Ecija",
    brand: "Yamaha",
    model: "NMAX 155",
    unitDescription: "Yamaha NMAX 155 2025, Matte Grey, 155cc",
    cashPrice: "130000.00",
    installmentPrice: "168000.00",
    downPayment: "28000.00",
    term: 48,
    startDate: "2026-05-01",
    dueDayOfMonth: 20,
  });
  console.log(`✓ Luzviminda Reyes — Yamaha NMAX, ₱140,000, 48mo`);

  // 7. Roberto Javier — Honda XRM, OVERDUE, missed several payments
  const roberto = await createInstallmentAccount({
    customerName: "Roberto Javier",
    customerPhone: "09568887766",
    customerAddress: "Barangay San Roque Norte, Cabanatuan City, Nueva Ecija",
    brand: "Honda",
    model: "XRM 125",
    unitDescription: "Honda XRM 125 2024, Red, 125cc (Motard)",
    cashPrice: "65000.00",
    installmentPrice: "78000.00",
    downPayment: "8000.00",
    term: 12,
    startDate: "2025-08-01",
    dueDayOfMonth: 10,
  });
  console.log(`✓ Roberto Javier — Honda XRM, ₱70,000, 12mo`);

  // 8. Catherine Dimagiba — Suzuki Skydrive, DUE_TODAY
  const catherine = await createInstallmentAccount({
    customerName: "Catherine Dimagiba",
    customerPhone: "09991234500",
    customerAddress: "Barangay Valdefuente, Cabanatuan City, Nueva Ecija",
    brand: "Suzuki",
    model: "Skydrive 125",
    unitDescription: "Suzuki Skydrive 125 2025, Black, 125cc",
    cashPrice: "72000.00",
    installmentPrice: "86000.00",
    downPayment: "14000.00",
    term: 18,
    startDate: "2026-04-20",
    dueDayOfMonth: 10,
  });
  console.log(`✓ Catherine Dimagiba — Suzuki Skydrive, ₱72,000, 18mo`);

  // 9. Mark Villanueva — Honda PCX, ACTIVE, on-time
  const mark = await createInstallmentAccount({
    customerName: "Mark Villanueva",
    customerPhone: "09123456789",
    customerAddress: "Barangay Caalibangbangan, Cabanatuan City, Nueva Ecija",
    brand: "Honda",
    model: "PCX 160",
    unitDescription: "Honda PCX 160 2025, Bronze, 160cc",
    cashPrice: "140000.00",
    installmentPrice: "172000.00",
    downPayment: "32000.00",
    term: 36,
    startDate: "2026-04-01",
    dueDayOfMonth: 30,
  });
  console.log(`✓ Mark Villanueva — Honda PCX, ₱140,000, 36mo`);

  // 10. Gloria Macapagal — Yamaha SZ, FULLY PAID
  const gloria = await createInstallmentAccount({
    customerName: "Gloria Macapagal",
    customerPhone: "09331237890",
    customerAddress: "Barangay Sumacab Este, Cabanatuan City, Nueva Ecija",
    brand: "Yamaha",
    model: "SZ16",
    unitDescription: "Yamaha SZ16 2024, Silver, 150cc",
    cashPrice: "85000.00",
    installmentPrice: "100000.00",
    downPayment: "15000.00",
    term: 12,
    startDate: "2025-05-01",
    dueDayOfMonth: 20,
  });
  console.log(`✓ Gloria Macapagal — Yamaha SZ, ₱85,000, 12mo`);

  // 11. Ronaldo Aquino — Kawasaki Rouser, ACTIVE, fresh
  const ronaldo = await createInstallmentAccount({
    customerName: "Ronaldo Aquino",
    customerPhone: "09661234511",
    customerAddress: "Barangay Mabini Extension, Cabanatuan City, Nueva Ecija",
    brand: "Kawasaki",
    model: "Rouser 250",
    unitDescription: "Kawasaki Rouser 250 2025, Black, 250cc",
    cashPrice: "160000.00",
    installmentPrice: "198000.00",
    downPayment: "38000.00",
    term: 36,
    startDate: "2026-06-01",
    dueDayOfMonth: 30,
  });
  console.log(`✓ Ronaldo Aquino — Kawasaki Rouser, ₱160,000, 36mo`);

  // 12. Teresa Mendoza — Honda Beat, ACTIVE, partial payer
  const teresa = await createInstallmentAccount({
    customerName: "Teresa Mendoza",
    customerPhone: "09771239876",
    customerAddress: "Barangay Bantug Norte, Cabanatuan City, Nueva Ecija",
    brand: "Honda",
    model: "Beat",
    unitDescription: "Honda Beat 2025, Pink, 110cc",
    cashPrice: "82000.00",
    installmentPrice: "98000.00",
    downPayment: "12000.00",
    term: 24,
    startDate: "2025-10-15",
    dueDayOfMonth: 10,
  });
  console.log(`✓ Teresa Mendoza — Honda Beat, ₱86,000, 24mo`);

  // 13. Danilo Santiago — Suzuki Smash, OVERDUE
  const danilo = await createInstallmentAccount({
    customerName: "Danilo Santiago",
    customerPhone: "09182345678",
    customerAddress: "Barangay San Isidro, Cabanatuan City, Nueva Ecija",
    brand: "Suzuki",
    model: "Smash 115",
    unitDescription: "Suzuki Smash 115 2023, Blue, 115cc",
    cashPrice: "55000.00",
    installmentPrice: "66000.00",
    downPayment: "6000.00",
    term: 12,
    startDate: "2025-06-01",
    dueDayOfMonth: 20,
  });
  console.log(`✓ Danilo Santiago — Suzuki Smash, ₱60,000, 12mo`);

  // 14. Rosario Luna — Yamaha Mio Gear, ACTIVE
  const rosario = await createInstallmentAccount({
    customerName: "Rosario Luna",
    customerPhone: "09442221133",
    customerAddress: "Barangay San Juan Poblacion, Cabanatuan City, Nueva Ecija",
    brand: "Yamaha",
    model: "Mio Gear",
    unitDescription: "Yamaha Mio Gear 2025, White, 125cc",
    cashPrice: "88000.00",
    installmentPrice: "106000.00",
    downPayment: "16000.00",
    term: 24,
    startDate: "2026-04-10",
    dueDayOfMonth: 30,
  });
  console.log(`✓ Rosario Luna — Yamaha Mio Gear, ₱90,000, 24mo`);

  // 15. Ferdinand Cruz — Honda TMX, ACTIVE, on-time
  const ferdinand = await createInstallmentAccount({
    customerName: "Ferdinand Cruz",
    customerPhone: "09998887766",
    customerAddress: "Barangay Palagay, Cabanatuan City, Nueva Ecija",
    brand: "Honda",
    model: "TMX 155",
    unitDescription: "Honda TMX 155 2024, Red, 155cc",
    cashPrice: "70000.00",
    installmentPrice: "84000.00",
    downPayment: "10000.00",
    term: 12,
    startDate: "2026-02-15",
    dueDayOfMonth: 10,
  });
  console.log(`✓ Ferdinand Cruz — Honda TMX, ₱74,000, 12mo`);

  // 16. Linda Castro — Yamaha Mio Soul, DUE_TODAY
  const linda = await createInstallmentAccount({
    customerName: "Linda Castro",
    customerPhone: "09551234987",
    customerAddress: "Barangay San Josef Sur, Cabanatuan City, Nueva Ecija",
    brand: "Yamaha",
    model: "Mio Soul 125",
    unitDescription: "Yamaha Mio Soul 125 2025, Red, 125cc",
    cashPrice: "78000.00",
    installmentPrice: "94000.00",
    downPayment: "14000.00",
    term: 18,
    startDate: "2026-05-10",
    dueDayOfMonth: 10,
  });
  console.log(`✓ Linda Castro — Yamaha Mio Soul, ₱80,000, 18mo`);

  // ── PAYMENTS ──────────────────────────────────────────

  console.log("\n— Posting payments —\n");

  // Juan: 2 on-time payments (discount), 1 late (penalty), 1 on-time
  const juanMonthly = new Decimal(juan.monthlyInstallment.toString());
  await postPayment({ installmentAccountId: juan.id, totalAmount: decimalToString(juanMonthly), paymentDate: "2026-02-18", method: "CASH", paymentType: "REGULAR", discountAmount: "200.00", cashier: "Megan", notes: "Early payment" });
  await postPayment({ installmentAccountId: juan.id, totalAmount: decimalToString(juanMonthly), paymentDate: "2026-03-28", method: "CASH", paymentType: "REGULAR", penaltyAmount: "200.00", cashier: "Megan", notes: "Late — 8 days overdue" });
  await postPayment({ installmentAccountId: juan.id, totalAmount: decimalToString(juanMonthly), paymentDate: "2026-04-18", method: "CASH", paymentType: "REGULAR", discountAmount: "200.00", cashier: "Megan" });
  await postPayment({ installmentAccountId: juan.id, totalAmount: decimalToString(juanMonthly), paymentDate: "2026-05-19", method: "GCASH", paymentType: "REGULAR", discountAmount: "200.00", cashier: "Megan" });
  console.log(`✓ Juan: 4 payments (3x discount, 1x penalty)`);

  // Maria: 2 advance payments (discount)
  const mariaMonthly = new Decimal(maria.monthlyInstallment.toString());
  await postPayment({ installmentAccountId: maria.id, totalAmount: decimalToString(mariaMonthly.times(3)), paymentDate: "2026-03-05", method: "GCASH", paymentType: "ADVANCE", discountAmount: "200.00", cashier: "John", notes: "Advance 3 months" });
  await postPayment({ installmentAccountId: maria.id, totalAmount: decimalToString(mariaMonthly), paymentDate: "2026-04-08", method: "CASH", paymentType: "REGULAR", discountAmount: "200.00", cashier: "John" });
  console.log(`✓ Maria: 2 payments (both with discount)`);

  // Pedro: full payment
  const pedroBalance = new Decimal(pedro.installmentPrice.toString()).minus(new Decimal(pedro.downPayment.toString()));
  await postPayment({ installmentAccountId: pedro.id, totalAmount: decimalToString(pedroBalance), paymentDate: "2026-04-15", method: "BANK", paymentType: "FULL", cashier: "John", notes: "Full settlement" });
  console.log(`✓ Pedro: Full payment`);

  // Jose: partial payment (paid less than monthly due)
  const joseMonthly = new Decimal(jose.monthlyInstallment.toString());
  await postPayment({ installmentAccountId: jose.id, totalAmount: decimalToString(joseMonthly), paymentDate: "2025-12-15", method: "CASH", paymentType: "REGULAR", cashier: "Megan" });
  await postPayment({ installmentAccountId: jose.id, totalAmount: decimalToString(joseMonthly), paymentDate: "2026-01-18", method: "CASH", paymentType: "REGULAR", discountAmount: "200.00", cashier: "Megan" });
  await postPayment({ installmentAccountId: jose.id, totalAmount: "3000.00", paymentDate: "2026-02-25", method: "CASH", paymentType: "PARTIAL", penaltyAmount: "200.00", cashier: "Megan", notes: "Partial — paid ₱3,000 only" });
  await postPayment({ installmentAccountId: jose.id, totalAmount: decimalToString(joseMonthly), paymentDate: "2026-03-19", method: "CASH", paymentType: "REGULAR", discountAmount: "200.00", cashier: "Megan" });
  console.log(`✓ Jose: 4 payments (1 partial, 1 penalty)`);

  // Roberto: 2 late payments (overdue)
  const robertoMonthly = new Decimal(roberto.monthlyInstallment.toString());
  await postPayment({ installmentAccountId: roberto.id, totalAmount: decimalToString(robertoMonthly), paymentDate: "2025-09-18", method: "CASH", paymentType: "REGULAR", discountAmount: "200.00", cashier: "John" });
  await postPayment({ installmentAccountId: roberto.id, totalAmount: decimalToString(robertoMonthly), paymentDate: "2025-10-25", method: "CASH", paymentType: "REGULAR", penaltyAmount: "200.00", cashier: "John" });
  console.log(`✓ Roberto: 2 payments (1 on-time, 1 late)`);

  // Danilo: 1 late payment (overdue)
  const daniloMonthly = new Decimal(danilo.monthlyInstallment.toString());
  await postPayment({ installmentAccountId: danilo.id, totalAmount: decimalToString(daniloMonthly), paymentDate: "2025-07-28", method: "CASH", paymentType: "REGULAR", penaltyAmount: "200.00", cashier: "John" });
  console.log(`✓ Danilo: 1 payment (late + penalty)`);

  // Gloria: full payment
  const gloriaBalance = new Decimal(gloria.installmentPrice.toString()).minus(new Decimal(gloria.downPayment.toString()));
  await postPayment({ installmentAccountId: gloria.id, totalAmount: decimalToString(gloriaBalance), paymentDate: "2025-11-15", method: "CASH", paymentType: "FULL", cashier: "Megan", notes: "Full settlement" });
  console.log(`✓ Gloria: Full payment`);

  // Teresa: partial payments
  const teresaMonthly = new Decimal(teresa.monthlyInstallment.toString());
  await postPayment({ installmentAccountId: teresa.id, totalAmount: decimalToString(teresaMonthly), paymentDate: "2025-11-08", method: "CASH", paymentType: "REGULAR", discountAmount: "200.00", cashier: "John" });
  await postPayment({ installmentAccountId: teresa.id, totalAmount: decimalToString(teresaMonthly), paymentDate: "2025-12-09", method: "CASH", paymentType: "REGULAR", cashier: "John" });
  await postPayment({ installmentAccountId: teresa.id, totalAmount: "5000.00", paymentDate: "2026-01-15", method: "CASH", paymentType: "PARTIAL", cashier: "John", notes: "Partial — paid ₱5,000" });
  await postPayment({ installmentAccountId: teresa.id, totalAmount: "4000.00", paymentDate: "2026-02-20", method: "CASH", paymentType: "PARTIAL", penaltyAmount: "200.00", cashier: "John", notes: "Partial — paid ₱4,000" });
  await postPayment({ installmentAccountId: teresa.id, totalAmount: "3000.00", paymentDate: "2026-03-25", method: "CASH", paymentType: "PARTIAL", penaltyAmount: "200.00", cashier: "John", notes: "Partial — paid ₱3,000" });
  console.log(`✓ Teresa: 5 payments (partials + penalties)`);

  // Mark: 2 on-time payments
  const markMonthly = new Decimal(mark.monthlyInstallment.toString());
  await postPayment({ installmentAccountId: mark.id, totalAmount: decimalToString(markMonthly), paymentDate: "2026-05-28", method: "BANK", paymentType: "REGULAR", discountAmount: "200.00", cashier: "Megan" });
  await postPayment({ installmentAccountId: mark.id, totalAmount: decimalToString(markMonthly), paymentDate: "2026-06-29", method: "BANK", paymentType: "REGULAR", cashier: "Megan" });
  console.log(`✓ Mark: 2 payments (both on-time)`);

  // Ferdinand: 4 on-time payments
  const ferdinandMonthly = new Decimal(ferdinand.monthlyInstallment.toString());
  await postPayment({ installmentAccountId: ferdinand.id, totalAmount: decimalToString(ferdinandMonthly), paymentDate: "2026-03-08", method: "CASH", paymentType: "REGULAR", discountAmount: "200.00", cashier: "Megan" });
  await postPayment({ installmentAccountId: ferdinand.id, totalAmount: decimalToString(ferdinandMonthly), paymentDate: "2026-04-09", method: "CASH", paymentType: "REGULAR", cashier: "Megan" });
  await postPayment({ installmentAccountId: ferdinand.id, totalAmount: decimalToString(ferdinandMonthly), paymentDate: "2026-05-08", method: "CASH", paymentType: "REGULAR", discountAmount: "200.00", cashier: "Megan" });
  await postPayment({ installmentAccountId: ferdinand.id, totalAmount: decimalToString(ferdinandMonthly), paymentDate: "2026-06-09", method: "GCASH", paymentType: "REGULAR", cashier: "Megan" });
  console.log(`✓ Ferdinand: 4 payments (all on-time)`);

  // Catherine: 1 on-time payment (still DUE_TODAY for current period)
  const catherineMonthly = new Decimal(catherine.monthlyInstallment.toString());
  await postPayment({ installmentAccountId: catherine.id, totalAmount: decimalToString(catherineMonthly), paymentDate: "2026-05-10", method: "CASH", paymentType: "REGULAR", cashier: "John" });
  console.log(`✓ Catherine: 1 payment (due today)`);

  // Linda: 1 payment (first period, paid on due date = no discount, no penalty)
  const lindaMonthly = new Decimal(linda.monthlyInstallment.toString());
  await postPayment({ installmentAccountId: linda.id, totalAmount: decimalToString(lindaMonthly), paymentDate: "2026-06-10", method: "GCASH", paymentType: "REGULAR", cashier: "Megan" });
  console.log(`✓ Linda: 1 payment (paid on due date)`);

  // ── SUMMARY ───────────────────────────────────────────

  console.log("\n═══════════════════════════════════════");
  console.log("  SEED COMPLETE");
  console.log("═══════════════════════════════════════\n");

  const summary = [
    ["Juan Dela Cruz", "Honda Beat", "ACTIVE", "₱3,583/mo"],
    ["Maria Santos", "Yamaha Mio", "ACTIVE", "₱2,783/mo"],
    ["Pedro Reyes", "Suzuki Raider", "FULLY PAID", "✓ Done"],
    ["Ana Gonzales", "Honda Click", "OVERDUE", "No payments yet"],
    ["Jose Mercado", "Kawasaki Barako", "OVERDUE", "Partial payer"],
    ["Luzviminda Reyes", "Yamaha NMAX", "ACTIVE", "New account"],
    ["Roberto Javier", "Honda XRM", "OVERDUE", "Missed payments"],
    ["Catherine Dimagiba", "Suzuki Skydrive", "DUE_TODAY", "1 payment made"],
    ["Mark Villanueva", "Honda PCX", "ACTIVE", "On-time"],
    ["Gloria Macapagal", "Yamaha SZ", "FULLY PAID", "✓ Done"],
    ["Ronaldo Aquino", "Kawasaki Rouser", "ACTIVE", "New account"],
    ["Teresa Mendoza", "Honda Beat", "OVERDUE", "Partial payer"],
    ["Danilo Santiago", "Suzuki Smash", "OVERDUE", "1 late payment"],
    ["Rosario Luna", "Yamaha Mio Gear", "ACTIVE", "No payments yet"],
    ["Ferdinand Cruz", "Honda TMX", "ACTIVE", "On-time"],
    ["Linda Castro", "Yamaha Mio Soul", "DUE_TODAY", "Paid on due"],
  ];

  console.log(`  ${"Customer".padEnd(22)} ${"Unit".padEnd(20)} ${"Status".padEnd(12)} Notes`);
  console.log(`  ${"─".repeat(22)} ${"─".repeat(20)} ${"─".repeat(12)} ${"─".repeat(20)}`);
  for (const [name, unit, status, notes] of summary) {
    console.log(`  ${name.padEnd(22)} ${unit.padEnd(20)} ${status.padEnd(12)} ${notes}`);
  }

  console.log("\n═══════════════════════════════════════\n");
  console.log("16 accounts created with realistic payment scenarios.");
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
