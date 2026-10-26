-- CreateEnum
CREATE TYPE "OpportunityStage" AS ENUM ('EXPLORING', 'VALIDATING', 'PURSUING', 'PARKED');

-- CreateTable
CREATE TABLE "OpportunityBoardItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "opportunitySlug" TEXT NOT NULL,
    "stage" "OpportunityStage" NOT NULL DEFAULT 'EXPLORING',
    "notes" TEXT NOT NULL DEFAULT '',
    "nextStep" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpportunityBoardItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpportunityScenario" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "calculatorId" TEXT NOT NULL,
    "opportunitySlug" TEXT,
    "name" TEXT NOT NULL,
    "inputs" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OpportunityScenario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OpportunityBoardItem_userId_opportunitySlug_key" ON "OpportunityBoardItem"("userId", "opportunitySlug");

-- CreateIndex
CREATE INDEX "OpportunityScenario_userId_calculatorId_idx" ON "OpportunityScenario"("userId", "calculatorId");

-- AddForeignKey
ALTER TABLE "OpportunityBoardItem" ADD CONSTRAINT "OpportunityBoardItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityScenario" ADD CONSTRAINT "OpportunityScenario_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
