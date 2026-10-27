-- CreateEnum
CREATE TYPE "TripStatus" AS ENUM ('WAITING', 'LIVE', 'ENDED');

-- CreateTable
CREATE TABLE "DriverTrip" (
    "id" TEXT NOT NULL,
    "gasOrderId" TEXT,
    "deliveryJobId" TEXT,
    "businessId" TEXT NOT NULL,
    "driverName" TEXT NOT NULL,
    "driverPhone" TEXT NOT NULL DEFAULT '',
    "tokenHash" TEXT NOT NULL,
    "status" "TripStatus" NOT NULL DEFAULT 'WAITING',
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "lastLat" DOUBLE PRECISION,
    "lastLon" DOUBLE PRECISION,
    "lastAccuracy" DOUBLE PRECISION,
    "lastSpeed" DOUBLE PRECISION,
    "lastAt" TIMESTAMP(3),
    "destLat" DOUBLE PRECISION,
    "destLon" DOUBLE PRECISION,
    "destLabel" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DriverTrip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TripPing" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lon" DOUBLE PRECISION NOT NULL,
    "accuracy" DOUBLE PRECISION,
    "speed" DOUBLE PRECISION,
    "heading" DOUBLE PRECISION,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TripPing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DriverTrip_gasOrderId_key" ON "DriverTrip"("gasOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "DriverTrip_deliveryJobId_key" ON "DriverTrip"("deliveryJobId");

-- CreateIndex
CREATE UNIQUE INDEX "DriverTrip_tokenHash_key" ON "DriverTrip"("tokenHash");

-- CreateIndex
CREATE INDEX "DriverTrip_status_endedAt_idx" ON "DriverTrip"("status", "endedAt");

-- CreateIndex
CREATE INDEX "TripPing_tripId_recordedAt_idx" ON "TripPing"("tripId", "recordedAt");

-- AddForeignKey
ALTER TABLE "DriverTrip" ADD CONSTRAINT "DriverTrip_gasOrderId_fkey" FOREIGN KEY ("gasOrderId") REFERENCES "GasOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverTrip" ADD CONSTRAINT "DriverTrip_deliveryJobId_fkey" FOREIGN KEY ("deliveryJobId") REFERENCES "DeliveryJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverTrip" ADD CONSTRAINT "DriverTrip_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "HubBusiness"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripPing" ADD CONSTRAINT "TripPing_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "DriverTrip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
