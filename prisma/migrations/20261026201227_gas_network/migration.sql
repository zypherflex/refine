-- CreateEnum
CREATE TYPE "GasSiteKind" AS ENUM ('TERMINAL', 'DEPOT', 'REFILL_PLANT', 'CYLINDER_RETAIL', 'CNG_STATION', 'CNG_MOTHER', 'LOGISTICS_BASE');

-- CreateEnum
CREATE TYPE "GasSiteStatus" AS ENUM ('OPERATING', 'PLANNED', 'CLOSED');

-- CreateTable
CREATE TABLE "GasSite" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "GasSiteKind" NOT NULL,
    "status" "GasSiteStatus" NOT NULL DEFAULT 'OPERATING',
    "gases" TEXT[],
    "cylinderSizes" DOUBLE PRECISION[] DEFAULT ARRAY[]::DOUBLE PRECISION[],
    "state" TEXT NOT NULL,
    "town" TEXT NOT NULL DEFAULT '',
    "address" TEXT NOT NULL DEFAULT '',
    "storageTonnes" DOUBLE PRECISION,
    "hours" TEXT NOT NULL DEFAULT '',
    "delivers" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT NOT NULL DEFAULT '',
    "lastConfirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GasSite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GasSite_state_status_idx" ON "GasSite"("state", "status");

-- CreateIndex
CREATE INDEX "GasSite_businessId_idx" ON "GasSite"("businessId");

-- AddForeignKey
ALTER TABLE "GasSite" ADD CONSTRAINT "GasSite_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "HubBusiness"("id") ON DELETE CASCADE ON UPDATE CASCADE;
