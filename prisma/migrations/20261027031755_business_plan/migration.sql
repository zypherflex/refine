-- AlterTable
ALTER TABLE "HubBusiness" ADD COLUMN     "planUntil" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "businessId" TEXT;
