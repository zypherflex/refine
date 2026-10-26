-- CreateEnum
CREATE TYPE "HubRole" AS ENUM ('SELLER', 'BUYER', 'DELIVERY', 'REFINERY');

-- CreateEnum
CREATE TYPE "HubVerification" AS ENUM ('UNVERIFIED', 'PENDING_REVIEW', 'VERIFIED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "HubListingKind" AS ENUM ('OFFER', 'REQUEST', 'DELIVERY');

-- CreateEnum
CREATE TYPE "HubListingStatus" AS ENUM ('ACTIVE', 'CLOSED');

-- CreateEnum
CREATE TYPE "HubReportStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateTable
CREATE TABLE "HubBusiness" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "roles" "HubRole"[],
    "about" TEXT NOT NULL DEFAULT '',
    "state" TEXT NOT NULL,
    "city" TEXT NOT NULL DEFAULT '',
    "website" TEXT NOT NULL DEFAULT '',
    "registrationNumber" TEXT NOT NULL DEFAULT '',
    "licences" TEXT NOT NULL DEFAULT '',
    "capacityBpd" INTEGER,
    "verification" "HubVerification" NOT NULL DEFAULT 'UNVERIFIED',
    "verificationNote" TEXT NOT NULL DEFAULT '',
    "verifiedAt" TIMESTAMP(3),
    "verifiedById" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HubBusiness_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HubListing" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "kind" "HubListingKind" NOT NULL,
    "title" TEXT NOT NULL,
    "details" TEXT NOT NULL DEFAULT '',
    "products" TEXT[],
    "quantity" DOUBLE PRECISION,
    "unit" TEXT NOT NULL DEFAULT '',
    "priceNote" TEXT NOT NULL DEFAULT '',
    "state" TEXT NOT NULL,
    "areas" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "HubListingStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HubListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HubThread" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "listingId" TEXT,
    "starterId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "starterReadAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ownerReadAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HubThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HubMessage" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HubMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HubReport" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "HubReportStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HubReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HubBusiness_ownerId_key" ON "HubBusiness"("ownerId");

-- CreateIndex
CREATE INDEX "HubBusiness_verification_idx" ON "HubBusiness"("verification");

-- CreateIndex
CREATE INDEX "HubListing_kind_status_expiresAt_idx" ON "HubListing"("kind", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "HubListing_businessId_idx" ON "HubListing"("businessId");

-- CreateIndex
CREATE INDEX "HubThread_starterId_lastMessageAt_idx" ON "HubThread"("starterId", "lastMessageAt");

-- CreateIndex
CREATE INDEX "HubThread_businessId_lastMessageAt_idx" ON "HubThread"("businessId", "lastMessageAt");

-- CreateIndex
CREATE UNIQUE INDEX "HubThread_starterId_businessId_listingId_key" ON "HubThread"("starterId", "businessId", "listingId");

-- CreateIndex
CREATE INDEX "HubMessage_threadId_createdAt_idx" ON "HubMessage"("threadId", "createdAt");

-- CreateIndex
CREATE INDEX "HubReport_status_idx" ON "HubReport"("status");

-- AddForeignKey
ALTER TABLE "HubBusiness" ADD CONSTRAINT "HubBusiness_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HubListing" ADD CONSTRAINT "HubListing_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "HubBusiness"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HubThread" ADD CONSTRAINT "HubThread_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "HubBusiness"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HubThread" ADD CONSTRAINT "HubThread_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "HubListing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HubThread" ADD CONSTRAINT "HubThread_starterId_fkey" FOREIGN KEY ("starterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HubMessage" ADD CONSTRAINT "HubMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "HubThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HubMessage" ADD CONSTRAINT "HubMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HubReport" ADD CONSTRAINT "HubReport_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "HubBusiness"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HubReport" ADD CONSTRAINT "HubReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
