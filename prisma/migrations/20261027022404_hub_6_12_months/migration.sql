-- CreateEnum
CREATE TYPE "FinanceStatus" AS ENUM ('SHARED', 'IN_REVIEW', 'OFFERED', 'DECLINED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "CylinderStatus" AS ENUM ('ACTIVE', 'CONDEMNED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "financePartnerId" TEXT,
ADD COLUMN     "priceDataUntil" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancePartner" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "states" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "products" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinancePartner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceRequest" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "amountNgn" INTEGER NOT NULL,
    "purpose" TEXT NOT NULL,
    "product" TEXT NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "status" "FinanceStatus" NOT NULL DEFAULT 'SHARED',
    "consentAt" TIMESTAMP(3) NOT NULL,
    "shareUntil" TIMESTAMP(3) NOT NULL,
    "partnerNote" TEXT NOT NULL DEFAULT '',
    "decidedAt" TIMESTAMP(3),
    "withdrawnAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cylinder" (
    "id" TEXT NOT NULL,
    "serial" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "holderId" TEXT NOT NULL,
    "sizeKg" DOUBLE PRECISION NOT NULL,
    "manufacturedOn" DATE,
    "lastTestOn" DATE NOT NULL,
    "nextTestDue" DATE NOT NULL,
    "status" "CylinderStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastFilledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Cylinder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CylinderEvent" (
    "id" TEXT NOT NULL,
    "cylinderId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "byId" TEXT NOT NULL,
    "toId" TEXT,
    "note" TEXT NOT NULL DEFAULT '',
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CylinderEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_hash_key" ON "ApiKey"("hash");

-- CreateIndex
CREATE INDEX "ApiKey_userId_idx" ON "ApiKey"("userId");

-- CreateIndex
CREATE INDEX "FinanceRequest_partnerId_status_idx" ON "FinanceRequest"("partnerId", "status");

-- CreateIndex
CREATE INDEX "FinanceRequest_businessId_idx" ON "FinanceRequest"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "Cylinder_serial_key" ON "Cylinder"("serial");

-- CreateIndex
CREATE INDEX "Cylinder_ownerId_idx" ON "Cylinder"("ownerId");

-- CreateIndex
CREATE INDEX "Cylinder_holderId_idx" ON "Cylinder"("holderId");

-- CreateIndex
CREATE INDEX "CylinderEvent_cylinderId_at_idx" ON "CylinderEvent"("cylinderId", "at");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_financePartnerId_fkey" FOREIGN KEY ("financePartnerId") REFERENCES "FinancePartner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceRequest" ADD CONSTRAINT "FinanceRequest_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "HubBusiness"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceRequest" ADD CONSTRAINT "FinanceRequest_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "FinancePartner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cylinder" ADD CONSTRAINT "Cylinder_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "HubBusiness"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cylinder" ADD CONSTRAINT "Cylinder_holderId_fkey" FOREIGN KEY ("holderId") REFERENCES "HubBusiness"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CylinderEvent" ADD CONSTRAINT "CylinderEvent_cylinderId_fkey" FOREIGN KEY ("cylinderId") REFERENCES "Cylinder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CylinderEvent" ADD CONSTRAINT "CylinderEvent_byId_fkey" FOREIGN KEY ("byId") REFERENCES "HubBusiness"("id") ON DELETE CASCADE ON UPDATE CASCADE;
