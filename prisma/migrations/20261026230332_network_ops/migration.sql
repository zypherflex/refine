-- CreateEnum
CREATE TYPE "DeliveryJobStatus" AS ENUM ('OPEN', 'AWARDED', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "AgreementFrequency" AS ENUM ('WEEKLY', 'FORTNIGHTLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "AgreementStatus" AS ENUM ('PROPOSED', 'ACTIVE', 'PAUSED', 'ENDED', 'DECLINED');

-- CreateEnum
CREATE TYPE "SupplyDeliveryStatus" AS ENUM ('LOGGED', 'CONFIRMED', 'DISPUTED');

-- CreateTable
CREATE TABLE "PriceReport" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "item" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "priceNaira" DOUBLE PRECISION NOT NULL,
    "day" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriceReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryJob" (
    "id" TEXT NOT NULL,
    "posterId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "products" TEXT[],
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "fromState" TEXT NOT NULL,
    "fromTown" TEXT NOT NULL DEFAULT '',
    "toState" TEXT NOT NULL,
    "toTown" TEXT NOT NULL DEFAULT '',
    "pickupDate" TIMESTAMP(3) NOT NULL,
    "details" TEXT NOT NULL DEFAULT '',
    "status" "DeliveryJobStatus" NOT NULL DEFAULT 'OPEN',
    "acceptedQuoteId" TEXT,
    "posterConfirmedAt" TIMESTAMP(3),
    "carrierConfirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryQuote" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "carrierId" TEXT NOT NULL,
    "priceNaira" DOUBLE PRECISION NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "status" "QuoteStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryQuote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplyAgreement" (
    "id" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "proposedById" TEXT NOT NULL,
    "product" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "frequency" "AgreementFrequency" NOT NULL,
    "deliverTo" TEXT NOT NULL,
    "priceNote" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "status" "AgreementStatus" NOT NULL DEFAULT 'PROPOSED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplyAgreement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplyDelivery" (
    "id" TEXT NOT NULL,
    "agreementId" TEXT NOT NULL,
    "deliveredOn" TIMESTAMP(3) NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "status" "SupplyDeliveryStatus" NOT NULL DEFAULT 'LOGGED',
    "buyerNote" TEXT NOT NULL DEFAULT '',
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplyDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PriceReport_item_day_idx" ON "PriceReport"("item", "day");

-- CreateIndex
CREATE UNIQUE INDEX "PriceReport_businessId_item_state_day_key" ON "PriceReport"("businessId", "item", "state", "day");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryJob_acceptedQuoteId_key" ON "DeliveryJob"("acceptedQuoteId");

-- CreateIndex
CREATE INDEX "DeliveryJob_status_pickupDate_idx" ON "DeliveryJob"("status", "pickupDate");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryQuote_jobId_carrierId_key" ON "DeliveryQuote"("jobId", "carrierId");

-- CreateIndex
CREATE INDEX "SupplyAgreement_buyerId_idx" ON "SupplyAgreement"("buyerId");

-- CreateIndex
CREATE INDEX "SupplyAgreement_sellerId_idx" ON "SupplyAgreement"("sellerId");

-- CreateIndex
CREATE UNIQUE INDEX "SupplyDelivery_agreementId_deliveredOn_key" ON "SupplyDelivery"("agreementId", "deliveredOn");

-- AddForeignKey
ALTER TABLE "PriceReport" ADD CONSTRAINT "PriceReport_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "HubBusiness"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryJob" ADD CONSTRAINT "DeliveryJob_posterId_fkey" FOREIGN KEY ("posterId") REFERENCES "HubBusiness"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryQuote" ADD CONSTRAINT "DeliveryQuote_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "DeliveryJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryQuote" ADD CONSTRAINT "DeliveryQuote_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "HubBusiness"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplyAgreement" ADD CONSTRAINT "SupplyAgreement_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "HubBusiness"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplyAgreement" ADD CONSTRAINT "SupplyAgreement_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "HubBusiness"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplyDelivery" ADD CONSTRAINT "SupplyDelivery_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "SupplyAgreement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
