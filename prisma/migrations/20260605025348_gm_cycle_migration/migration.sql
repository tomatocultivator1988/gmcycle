-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'DUE_TODAY', 'OVERDUE', 'FULLY_PAID');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'GCASH', 'BANK');

-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('REGULAR', 'PARTIAL', 'ADVANCE', 'FULL');

-- CreateEnum
CREATE TYPE "ScheduleStatus" AS ENUM ('PENDING', 'PAID', 'OVERDUE', 'PARTIAL');

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "idNumber" TEXT NOT NULL,
    "validIdType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstallmentAccount" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "unitDescription" TEXT NOT NULL,
    "cashPrice" DECIMAL(12,2) NOT NULL,
    "installmentPrice" DECIMAL(12,2) NOT NULL,
    "downPayment" DECIMAL(12,2) NOT NULL,
    "remainingBalance" DECIMAL(12,2) NOT NULL,
    "term" INTEGER NOT NULL,
    "monthlyInstallment" DECIMAL(12,2) NOT NULL,
    "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "startDate" TIMESTAMP(3) NOT NULL,
    "dueDayOfMonth" INTEGER NOT NULL,
    "nextDueDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstallmentAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstallmentSchedule" (
    "id" TEXT NOT NULL,
    "installmentAccountId" TEXT NOT NULL,
    "periodNumber" INTEGER NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "status" "ScheduleStatus" NOT NULL DEFAULT 'PENDING',
    "paidDate" TIMESTAMP(3),
    "paymentId" TEXT,
    "paidAmount" DECIMAL(12,2),
    "penaltyAmount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,

    CONSTRAINT "InstallmentSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "installmentAccountId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "orNumber" TEXT NOT NULL,
    "paymentType" "PaymentType" NOT NULL,
    "penaltyAmount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "notes" TEXT,
    "cashier" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PenaltyRecord" (
    "id" TEXT NOT NULL,
    "installmentAccountId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "appliedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,

    CONSTRAINT "PenaltyRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscountRecord" (
    "id" TEXT NOT NULL,
    "installmentAccountId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "appliedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,

    CONSTRAINT "DiscountRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminConfig" (
    "id" TEXT NOT NULL,
    "penaltyAmount" DECIMAL(12,2) NOT NULL DEFAULT 200.00,
    "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 200.00,
    "dueDayOptions" INTEGER[] DEFAULT ARRAY[10, 20, 30]::INTEGER[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Customer_fullName_idx" ON "Customer"("fullName");

-- CreateIndex
CREATE INDEX "InstallmentAccount_customerId_idx" ON "InstallmentAccount"("customerId");

-- CreateIndex
CREATE INDEX "InstallmentAccount_status_idx" ON "InstallmentAccount"("status");

-- CreateIndex
CREATE INDEX "InstallmentAccount_nextDueDate_idx" ON "InstallmentAccount"("nextDueDate");

-- CreateIndex
CREATE INDEX "InstallmentSchedule_installmentAccountId_idx" ON "InstallmentSchedule"("installmentAccountId");

-- CreateIndex
CREATE INDEX "InstallmentSchedule_dueDate_idx" ON "InstallmentSchedule"("dueDate");

-- CreateIndex
CREATE INDEX "InstallmentSchedule_status_idx" ON "InstallmentSchedule"("status");

-- CreateIndex
CREATE INDEX "Payment_installmentAccountId_idx" ON "Payment"("installmentAccountId");

-- CreateIndex
CREATE INDEX "Payment_customerId_idx" ON "Payment"("customerId");

-- CreateIndex
CREATE INDEX "Payment_paymentDate_idx" ON "Payment"("paymentDate");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_orNumber_key" ON "Payment"("orNumber");

-- CreateIndex
CREATE INDEX "PenaltyRecord_installmentAccountId_idx" ON "PenaltyRecord"("installmentAccountId");

-- CreateIndex
CREATE INDEX "PenaltyRecord_appliedDate_idx" ON "PenaltyRecord"("appliedDate");

-- CreateIndex
CREATE INDEX "DiscountRecord_installmentAccountId_idx" ON "DiscountRecord"("installmentAccountId");

-- CreateIndex
CREATE INDEX "DiscountRecord_appliedDate_idx" ON "DiscountRecord"("appliedDate");

-- AddForeignKey
ALTER TABLE "InstallmentAccount" ADD CONSTRAINT "InstallmentAccount_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstallmentSchedule" ADD CONSTRAINT "InstallmentSchedule_installmentAccountId_fkey" FOREIGN KEY ("installmentAccountId") REFERENCES "InstallmentAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_installmentAccountId_fkey" FOREIGN KEY ("installmentAccountId") REFERENCES "InstallmentAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PenaltyRecord" ADD CONSTRAINT "PenaltyRecord_installmentAccountId_fkey" FOREIGN KEY ("installmentAccountId") REFERENCES "InstallmentAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PenaltyRecord" ADD CONSTRAINT "PenaltyRecord_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscountRecord" ADD CONSTRAINT "DiscountRecord_installmentAccountId_fkey" FOREIGN KEY ("installmentAccountId") REFERENCES "InstallmentAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscountRecord" ADD CONSTRAINT "DiscountRecord_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
