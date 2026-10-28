-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'NGN',
ADD COLUMN     "dataAccountId" TEXT,
ADD COLUMN     "periodDays" INTEGER;

-- CreateTable
CREATE TABLE "PriceIndexDaily" (
    "id" TEXT NOT NULL,
    "day" TIMESTAMP(3) NOT NULL,
    "state" TEXT NOT NULL,
    "item" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "median" DOUBLE PRECISION NOT NULL,
    "low" DOUBLE PRECISION NOT NULL,
    "high" DOUBLE PRECISION NOT NULL,
    "reporters" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceIndexDaily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organisation" TEXT NOT NULL,
    "billingCountry" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "paidUntil" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DataAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiUsage" (
    "id" TEXT NOT NULL,
    "keyId" TEXT NOT NULL,
    "day" TIMESTAMP(3) NOT NULL,
    "requests" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ApiUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sponsorship" (
    "id" TEXT NOT NULL,
    "sponsor" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "placements" TEXT[],
    "states" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "priceUsd" DOUBLE PRECISION NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sponsorship_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PriceIndexDaily_item_day_idx" ON "PriceIndexDaily"("item", "day");

-- CreateIndex
CREATE UNIQUE INDEX "PriceIndexDaily_day_state_item_source_key" ON "PriceIndexDaily"("day", "state", "item", "source");

-- CreateIndex
CREATE UNIQUE INDEX "DataAccount_userId_key" ON "DataAccount"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_hash_key" ON "ApiKey"("hash");

-- CreateIndex
CREATE INDEX "ApiKey_accountId_idx" ON "ApiKey"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "ApiUsage_keyId_day_key" ON "ApiUsage"("keyId", "day");

-- CreateIndex
CREATE INDEX "Sponsorship_active_startsAt_endsAt_idx" ON "Sponsorship"("active", "startsAt", "endsAt");

-- AddForeignKey
ALTER TABLE "DataAccount" ADD CONSTRAINT "DataAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "DataAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiUsage" ADD CONSTRAINT "ApiUsage_keyId_fkey" FOREIGN KEY ("keyId") REFERENCES "ApiKey"("id") ON DELETE CASCADE ON UPDATE CASCADE;
