-- CreateEnum
CREATE TYPE "HubVerification" AS ENUM ('UNVERIFIED', 'PENDING', 'VERIFIED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "ListingKind" AS ENUM ('OFFER', 'REQUEST');

-- CreateEnum
CREATE TYPE "GasSiteKind" AS ENUM ('SUPPLY', 'DELIVERY', 'DEMAND');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('OPEN', 'AWARDED', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "AgreementStatus" AS ENUM ('PROPOSED', 'ACTIVE', 'DECLINED', 'ENDED');

-- CreateTable
CREATE TABLE "HubBusiness" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "roles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "products" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "state" TEXT NOT NULL,
    "town" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "cacNumber" TEXT NOT NULL DEFAULT '',
    "licenceNumbers" TEXT NOT NULL DEFAULT '',
    "verification" "HubVerification" NOT NULL DEFAULT 'UNVERIFIED',
    "verificationNote" TEXT NOT NULL DEFAULT '',
    "verificationAskedAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "verifiedById" TEXT,
    "isSample" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HubBusiness_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HubListing" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "kind" "ListingKind" NOT NULL,
    "product" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "details" TEXT NOT NULL DEFAULT '',
    "promoted" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HubListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HubEnquiry" (
    "id" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "listingId" TEXT,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HubEnquiry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HubReport" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "details" TEXT NOT NULL DEFAULT '',
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HubReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceReport" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "product" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "priceNgn" DOUBLE PRECISION NOT NULL,
    "chargedOn" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GasSite" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "kind" "GasSiteKind" NOT NULL,
    "gas" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "town" TEXT NOT NULL DEFAULT '',
    "capacityNote" TEXT NOT NULL DEFAULT '',
    "lastConfirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GasSite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryJob" (
    "id" TEXT NOT NULL,
    "posterId" TEXT NOT NULL,
    "product" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "fromState" TEXT NOT NULL,
    "fromPlace" TEXT NOT NULL,
    "toState" TEXT NOT NULL,
    "toPlace" TEXT NOT NULL,
    "readyBy" DATE NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "status" "JobStatus" NOT NULL DEFAULT 'OPEN',
    "acceptedQuoteId" TEXT,
    "posterConfirmedAt" TIMESTAMP(3),
    "haulierConfirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeliveryJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryQuote" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "haulierId" TEXT NOT NULL,
    "priceNgn" DOUBLE PRECISION NOT NULL,
    "days" INTEGER NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "status" "QuoteStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

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
    "frequency" TEXT NOT NULL,
    "deliverTo" TEXT NOT NULL DEFAULT '',
    "startsOn" DATE NOT NULL,
    "status" "AgreementStatus" NOT NULL DEFAULT 'PROPOSED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplyAgreement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplyDelivery" (
    "id" TEXT NOT NULL,
    "agreementId" TEXT NOT NULL,
    "deliveredOn" DATE NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "sellerConfirmedAt" TIMESTAMP(3),
    "buyerConfirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplyDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanInterest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "line" TEXT NOT NULL,
    "message" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanInterest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HubBusiness_ownerId_key" ON "HubBusiness"("ownerId");

-- CreateIndex
CREATE INDEX "HubBusiness_state_idx" ON "HubBusiness"("state");

-- CreateIndex
CREATE INDEX "HubBusiness_verification_idx" ON "HubBusiness"("verification");

-- CreateIndex
CREATE INDEX "HubListing_active_product_state_idx" ON "HubListing"("active", "product", "state");

-- CreateIndex
CREATE INDEX "HubEnquiry_toId_createdAt_idx" ON "HubEnquiry"("toId", "createdAt");

-- CreateIndex
CREATE INDEX "HubReport_resolved_idx" ON "HubReport"("resolved");

-- CreateIndex
CREATE INDEX "PriceReport_product_state_chargedOn_idx" ON "PriceReport"("product", "state", "chargedOn");

-- CreateIndex
CREATE UNIQUE INDEX "PriceReport_businessId_product_state_chargedOn_key" ON "PriceReport"("businessId", "product", "state", "chargedOn");

-- CreateIndex
CREATE INDEX "GasSite_gas_state_idx" ON "GasSite"("gas", "state");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryJob_acceptedQuoteId_key" ON "DeliveryJob"("acceptedQuoteId");

-- CreateIndex
CREATE INDEX "DeliveryJob_status_fromState_idx" ON "DeliveryJob"("status", "fromState");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryQuote_jobId_haulierId_key" ON "DeliveryQuote"("jobId", "haulierId");

-- CreateIndex
CREATE INDEX "SupplyAgreement_buyerId_idx" ON "SupplyAgreement"("buyerId");

-- CreateIndex
CREATE INDEX "SupplyAgreement_sellerId_idx" ON "SupplyAgreement"("sellerId");

-- CreateIndex
CREATE INDEX "SupplyDelivery_agreementId_deliveredOn_idx" ON "SupplyDelivery"("agreementId", "deliveredOn");

-- CreateIndex
CREATE UNIQUE INDEX "PlanInterest_userId_line_key" ON "PlanInterest"("userId", "line");

-- AddForeignKey
ALTER TABLE "HubBusiness" ADD CONSTRAINT "HubBusiness_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HubListing" ADD CONSTRAINT "HubListing_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "HubBusiness"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HubEnquiry" ADD CONSTRAINT "HubEnquiry_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "HubBusiness"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HubEnquiry" ADD CONSTRAINT "HubEnquiry_toId_fkey" FOREIGN KEY ("toId") REFERENCES "HubBusiness"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HubEnquiry" ADD CONSTRAINT "HubEnquiry_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "HubListing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HubReport" ADD CONSTRAINT "HubReport_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "HubBusiness"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceReport" ADD CONSTRAINT "PriceReport_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "HubBusiness"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GasSite" ADD CONSTRAINT "GasSite_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "HubBusiness"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryJob" ADD CONSTRAINT "DeliveryJob_posterId_fkey" FOREIGN KEY ("posterId") REFERENCES "HubBusiness"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryQuote" ADD CONSTRAINT "DeliveryQuote_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "DeliveryJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryQuote" ADD CONSTRAINT "DeliveryQuote_haulierId_fkey" FOREIGN KEY ("haulierId") REFERENCES "HubBusiness"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplyAgreement" ADD CONSTRAINT "SupplyAgreement_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "HubBusiness"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplyAgreement" ADD CONSTRAINT "SupplyAgreement_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "HubBusiness"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplyDelivery" ADD CONSTRAINT "SupplyDelivery_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "SupplyAgreement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanInterest" ADD CONSTRAINT "PlanInterest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
