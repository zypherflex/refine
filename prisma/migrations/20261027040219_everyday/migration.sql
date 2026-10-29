-- CreateEnum
CREATE TYPE "Audience" AS ENUM ('PERSONAL', 'BUSINESS');

-- CreateEnum
CREATE TYPE "OutletKind" AS ENUM ('FILLING_STATION', 'GAS_RETAILER', 'CNG_STATION');

-- CreateEnum
CREATE TYPE "OutletReportKind" AS ENUM ('PRICE', 'AVAILABILITY', 'PROBLEM');

-- CreateEnum
CREATE TYPE "GasOrderStatus" AS ENUM ('PLACED', 'ACCEPTED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'DECLINED', 'CANCELLED');

-- AlterTable
ALTER TABLE "HubBusiness" ADD COLUMN     "deliveryFeeNaira" DOUBLE PRECISION,
ADD COLUMN     "deliveryStates" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "homeDelivery" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "homePricePerKg" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "audience" "Audience" NOT NULL DEFAULT 'BUSINESS',
ADD COLUMN     "homeState" TEXT;

-- CreateTable
CREATE TABLE "Outlet" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT NOT NULL DEFAULT '',
    "kind" "OutletKind" NOT NULL,
    "state" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "address" TEXT NOT NULL DEFAULT '',
    "lat" DOUBLE PRECISION,
    "lon" DOUBLE PRECISION,
    "addedById" TEXT,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Outlet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutletReport" (
    "id" TEXT NOT NULL,
    "outletId" TEXT NOT NULL,
    "userId" TEXT,
    "kind" "OutletReportKind" NOT NULL,
    "item" TEXT,
    "priceNaira" DOUBLE PRECISION,
    "available" BOOLEAN,
    "queue" TEXT,
    "problem" TEXT,
    "note" TEXT NOT NULL DEFAULT '',
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutletReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GasOrder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "cylinderKg" DOUBLE PRECISION NOT NULL,
    "cylinders" INTEGER NOT NULL DEFAULT 1,
    "state" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "estimateNaira" DOUBLE PRECISION,
    "priceNaira" DOUBLE PRECISION,
    "status" "GasOrderStatus" NOT NULL DEFAULT 'PLACED',
    "sellerNote" TEXT NOT NULL DEFAULT '',
    "rating" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deliveredAt" TIMESTAMP(3),

    CONSTRAINT "GasOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GasCylinder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT 'Kitchen',
    "sizeKg" DOUBLE PRECISION NOT NULL,
    "usualDays" INTEGER NOT NULL DEFAULT 30,
    "remind" BOOLEAN NOT NULL DEFAULT true,
    "remindedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GasCylinder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CylinderRefill" (
    "id" TEXT NOT NULL,
    "cylinderId" TEXT NOT NULL,
    "filledAt" TIMESTAMP(3) NOT NULL,
    "priceNaira" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CylinderRefill_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Outlet_state_kind_idx" ON "Outlet"("state", "kind");

-- CreateIndex
CREATE INDEX "OutletReport_outletId_createdAt_idx" ON "OutletReport"("outletId", "createdAt");

-- CreateIndex
CREATE INDEX "OutletReport_kind_item_createdAt_idx" ON "OutletReport"("kind", "item", "createdAt");

-- CreateIndex
CREATE INDEX "OutletReport_userId_createdAt_idx" ON "OutletReport"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "GasOrder_userId_createdAt_idx" ON "GasOrder"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "GasOrder_businessId_status_idx" ON "GasOrder"("businessId", "status");

-- CreateIndex
CREATE INDEX "GasCylinder_userId_idx" ON "GasCylinder"("userId");

-- CreateIndex
CREATE INDEX "CylinderRefill_cylinderId_filledAt_idx" ON "CylinderRefill"("cylinderId", "filledAt");

-- AddForeignKey
ALTER TABLE "Outlet" ADD CONSTRAINT "Outlet_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutletReport" ADD CONSTRAINT "OutletReport_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "Outlet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutletReport" ADD CONSTRAINT "OutletReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GasOrder" ADD CONSTRAINT "GasOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GasOrder" ADD CONSTRAINT "GasOrder_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "HubBusiness"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GasCylinder" ADD CONSTRAINT "GasCylinder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CylinderRefill" ADD CONSTRAINT "CylinderRefill_cylinderId_fkey" FOREIGN KEY ("cylinderId") REFERENCES "GasCylinder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
