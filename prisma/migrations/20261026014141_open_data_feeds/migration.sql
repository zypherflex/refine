-- CreateEnum
CREATE TYPE "ContextScope" AS ENUM ('GLOBAL_MARKET', 'NIGERIA_MACRO');

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "newsQuery" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "MarketSeries" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "contextScope" "ContextScope" NOT NULL,
    "geography" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourcePageUrl" TEXT NOT NULL DEFAULT '',
    "attribution" TEXT NOT NULL DEFAULT '',
    "lastRetrievedAt" TIMESTAMP(3),
    "lastError" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketSeries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketObservation" (
    "id" TEXT NOT NULL,
    "seriesId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "value" DECIMAL(24,6) NOT NULL,
    "retrievedAt" TIMESTAMP(3) NOT NULL,
    "requestUrl" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "MarketObservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngestionRun" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "message" TEXT NOT NULL DEFAULT '',
    "itemsUpserted" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "IngestionRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewsLead" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "domain" TEXT NOT NULL DEFAULT '',
    "language" TEXT NOT NULL DEFAULT '',
    "sourceCountry" TEXT NOT NULL DEFAULT '',
    "seenAt" TIMESTAMP(3) NOT NULL,
    "retrievedAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NewsLead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefineryAsset" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "assetType" TEXT NOT NULL DEFAULT '',
    "capacityBpd" DECIMAL(14,2),
    "owners" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "lat" DOUBLE PRECISION,
    "lon" DOUBLE PRECISION,
    "emissionsTCo2e" DECIMAL(18,2),
    "emissionsYear" INTEGER,
    "sourceId" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL DEFAULT '',
    "retrievedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RefineryAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MarketSeries_key_key" ON "MarketSeries"("key");

-- CreateIndex
CREATE INDEX "MarketObservation_seriesId_periodStart_idx" ON "MarketObservation"("seriesId", "periodStart");

-- CreateIndex
CREATE UNIQUE INDEX "MarketObservation_seriesId_period_key" ON "MarketObservation"("seriesId", "period");

-- CreateIndex
CREATE INDEX "IngestionRun_provider_startedAt_idx" ON "IngestionRun"("provider", "startedAt");

-- CreateIndex
CREATE INDEX "NewsLead_status_seenAt_idx" ON "NewsLead"("status", "seenAt");

-- CreateIndex
CREATE UNIQUE INDEX "NewsLead_companyId_url_key" ON "NewsLead"("companyId", "url");

-- CreateIndex
CREATE INDEX "RefineryAsset_countryCode_idx" ON "RefineryAsset"("countryCode");

-- CreateIndex
CREATE UNIQUE INDEX "RefineryAsset_provider_externalId_key" ON "RefineryAsset"("provider", "externalId");

-- AddForeignKey
ALTER TABLE "MarketSeries" ADD CONSTRAINT "MarketSeries_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketObservation" ADD CONSTRAINT "MarketObservation_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "MarketSeries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewsLead" ADD CONSTRAINT "NewsLead_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefineryAsset" ADD CONSTRAINT "RefineryAsset_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
