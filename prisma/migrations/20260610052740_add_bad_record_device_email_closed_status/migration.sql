-- AlterEnum
ALTER TYPE "AccountStatus" ADD VALUE 'CLOSED';

-- AlterTable
ALTER TABLE "InstallmentAccount" ADD COLUMN     "badRecord" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "badRecordRemark" TEXT,
ADD COLUMN     "deviceAccountHolderEmail" TEXT,
ADD COLUMN     "deviceEmail" TEXT,
ADD COLUMN     "deviceEmailPassword" TEXT,
ADD COLUMN     "remarks" TEXT;
