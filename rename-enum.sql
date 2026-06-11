ALTER TABLE "InstallmentAccount" ALTER COLUMN "pricingType" DROP DEFAULT;
ALTER TYPE "PricingType" RENAME TO "PricingType_old";
CREATE TYPE "PricingType" AS ENUM ('GADGET_RATE', 'CASH_PERCENTAGE');
ALTER TABLE "InstallmentAccount" ALTER COLUMN "pricingType" TYPE "PricingType" USING 
  CASE 
    WHEN "pricingType"::text = 'FLAT_RATE' THEN 'GADGET_RATE'::"PricingType"
    WHEN "pricingType"::text = 'INTEREST_PERCENTAGE' THEN 'CASH_PERCENTAGE'::"PricingType"
  END;
ALTER TABLE "InstallmentAccount" ALTER COLUMN "pricingType" SET DEFAULT 'GADGET_RATE';
DROP TYPE "PricingType_old";
