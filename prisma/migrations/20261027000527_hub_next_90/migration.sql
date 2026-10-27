-- CreateEnum
CREATE TYPE "VisitStatus" AS ENUM ('ASSIGNED', 'SUBMITTED', 'ACCEPTED', 'REJECTED', 'CANCELLED');

-- AlterTable
ALTER TABLE "HubBusiness" ADD COLUMN     "plan" TEXT NOT NULL DEFAULT 'FREE',
ADD COLUMN     "planUntil" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "agentAreas" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "fieldAgent" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "PriceAlertSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "states" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "products" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "channels" TEXT[] DEFAULT ARRAY['IN_APP']::TEXT[],
    "language" TEXT NOT NULL DEFAULT 'en',
    "phone" TEXT NOT NULL DEFAULT '',
    "phoneConfirmedAt" TIMESTAMP(3),
    "phoneCodeHash" TEXT NOT NULL DEFAULT '',
    "phoneCodeSentAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastSentOn" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriceAlertSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboundMessage" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "channel" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "providerId" TEXT NOT NULL DEFAULT '',
    "error" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "OutboundMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FieldVisit" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "assignedById" TEXT NOT NULL,
    "status" "VisitStatus" NOT NULL DEFAULT 'ASSIGNED',
    "cacSeen" BOOLEAN NOT NULL DEFAULT false,
    "licenceSeen" BOOLEAN NOT NULL DEFAULT false,
    "premisesSeen" BOOLEAN NOT NULL DEFAULT false,
    "phoneAnswered" BOOLEAN NOT NULL DEFAULT false,
    "productSeen" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT NOT NULL DEFAULT '',
    "visitedOn" DATE,
    "submittedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "reviewNote" TEXT NOT NULL DEFAULT '',
    "payoutNgn" INTEGER NOT NULL DEFAULT 0,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FieldVisit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PriceAlertSubscription_userId_key" ON "PriceAlertSubscription"("userId");

-- CreateIndex
CREATE INDEX "OutboundMessage_status_createdAt_idx" ON "OutboundMessage"("status", "createdAt");

-- CreateIndex
CREATE INDEX "FieldVisit_agentId_status_idx" ON "FieldVisit"("agentId", "status");

-- CreateIndex
CREATE INDEX "FieldVisit_businessId_idx" ON "FieldVisit"("businessId");

-- AddForeignKey
ALTER TABLE "PriceAlertSubscription" ADD CONSTRAINT "PriceAlertSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldVisit" ADD CONSTRAINT "FieldVisit_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "HubBusiness"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldVisit" ADD CONSTRAINT "FieldVisit_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
