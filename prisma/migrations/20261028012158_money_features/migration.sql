-- AlterTable
ALTER TABLE "GasOrder" ADD COLUMN     "commissionNaira" DOUBLE PRECISION,
ADD COLUMN     "commissionSettledAt" TIMESTAMP(3),
ADD COLUMN     "paidOnlineAt" TIMESTAMP(3),
ADD COLUMN     "payoutAt" TIMESTAMP(3),
ADD COLUMN     "recipientName" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "serviceFeeNaira" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "gasOrderId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "planUntil" TIMESTAMP(3);
