/*
  Warnings:

  - You are about to drop the column `customerId` on the `InstallmentAccount` table. All the data in the column will be lost.
  - You are about to drop the column `customerId` on the `Payment` table. All the data in the column will be lost.
  - You are about to drop the column `orNumber` on the `Payment` table. All the data in the column will be lost.
  - You are about to drop the `Customer` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `customerAddress` to the `InstallmentAccount` table without a default value. This is not possible if the table is not empty.
  - Added the required column `customerName` to the `InstallmentAccount` table without a default value. This is not possible if the table is not empty.
  - Added the required column `customerPhone` to the `InstallmentAccount` table without a default value. This is not possible if the table is not empty.
  - Added the required column `customerName` to the `Payment` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "InstallmentAccount" DROP CONSTRAINT "InstallmentAccount_customerId_fkey";

-- DropForeignKey
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_customerId_fkey";

-- DropIndex
DROP INDEX "InstallmentAccount_customerId_idx";

-- DropIndex
DROP INDEX "Payment_customerId_idx";

-- DropIndex
DROP INDEX "Payment_orNumber_key";

-- AlterTable
ALTER TABLE "AdminConfig" ALTER COLUMN "dueDayOptions" SET DEFAULT ARRAY[15, 30]::INTEGER[];

-- AlterTable
ALTER TABLE "InstallmentAccount" DROP COLUMN "customerId",
ADD COLUMN     "customerAddress" TEXT NOT NULL,
ADD COLUMN     "customerName" TEXT NOT NULL,
ADD COLUMN     "customerPhone" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Payment" DROP COLUMN "customerId",
DROP COLUMN "orNumber",
ADD COLUMN     "customerName" TEXT NOT NULL;

-- DropTable
DROP TABLE "Customer";

-- CreateIndex
CREATE INDEX "InstallmentAccount_customerName_idx" ON "InstallmentAccount"("customerName");
