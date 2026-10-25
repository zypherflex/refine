-- AlterTable
ALTER TABLE "Alert" ADD COLUMN     "emailedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailAlerts" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Alert_emailedAt_visibleAt_idx" ON "Alert"("emailedAt", "visibleAt");
