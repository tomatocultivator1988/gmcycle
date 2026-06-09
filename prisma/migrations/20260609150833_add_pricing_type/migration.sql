-- CreateEnum
CREATE TYPE "PricingType" AS ENUM ('FLAT_RATE', 'INTEREST_PERCENTAGE');

-- AlterTable
ALTER TABLE "InstallmentAccount" ADD COLUMN     "interestRate" DECIMAL(5,2),
ADD COLUMN     "pricingType" "PricingType" NOT NULL DEFAULT 'FLAT_RATE',
ALTER COLUMN "status" SET DEFAULT 'APPLIED';
