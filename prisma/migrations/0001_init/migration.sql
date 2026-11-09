-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" SERIAL NOT NULL,
    "regNo" TEXT NOT NULL,
    "ownerType" TEXT NOT NULL DEFAULT 'OWN',
    "usualDriverId" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Driver" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Driver_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DriverAlias" (
    "id" SERIAL NOT NULL,
    "alias" TEXT NOT NULL,
    "driverId" INTEGER NOT NULL,

    CONSTRAINT "DriverAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Location" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "district" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LocationAlias" (
    "id" SERIAL NOT NULL,
    "alias" TEXT NOT NULL,
    "locationId" INTEGER NOT NULL,

    CONSTRAINT "LocationAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dealer" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT,
    "phone" TEXT,

    CONSTRAINT "Dealer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateCard" (
    "id" SERIAL NOT NULL,
    "originId" INTEGER NOT NULL,
    "destinationKey" TEXT NOT NULL,
    "freight" INTEGER NOT NULL,
    "stdDieselL" DOUBLE PRECISION NOT NULL,
    "driverAllowance" INTEGER NOT NULL,
    "podCharge" INTEGER NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE,

    CONSTRAINT "RateCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DieselRate" (
    "id" SERIAL NOT NULL,
    "ratePaise" INTEGER NOT NULL,
    "effectiveFrom" DATE NOT NULL,

    CONSTRAINT "DieselRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trip" (
    "id" SERIAL NOT NULL,
    "serialNo" INTEGER NOT NULL,
    "tripDate" DATE NOT NULL,
    "monthKey" TEXT NOT NULL,
    "lrNo" TEXT NOT NULL,
    "vehicleId" INTEGER NOT NULL,
    "driverId" INTEGER,
    "originId" INTEGER NOT NULL,
    "carsCount" INTEGER NOT NULL,
    "dieselL" DOUBLE PRECISION NOT NULL,
    "dieselRate" INTEGER NOT NULL,
    "podCharge" INTEGER NOT NULL,
    "maintenance" INTEGER NOT NULL,
    "driverAllowance" INTEGER NOT NULL,
    "freight" INTEGER NOT NULL,
    "dieselAmount" INTEGER NOT NULL,
    "totalCost" INTEGER NOT NULL,
    "profit" INTEGER NOT NULL,
    "dealerId" INTEGER,
    "billingStatus" TEXT NOT NULL DEFAULT 'UNBILLED',
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Trip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TripStop" (
    "id" SERIAL NOT NULL,
    "tripId" INTEGER NOT NULL,
    "locationId" INTEGER NOT NULL,
    "seq" INTEGER NOT NULL,

    CONSTRAINT "TripStop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" SERIAL NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "changes" TEXT NOT NULL,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_regNo_key" ON "Vehicle"("regNo");

-- CreateIndex
CREATE UNIQUE INDEX "Driver_name_key" ON "Driver"("name");

-- CreateIndex
CREATE UNIQUE INDEX "DriverAlias_alias_key" ON "DriverAlias"("alias");

-- CreateIndex
CREATE UNIQUE INDEX "Location_name_key" ON "Location"("name");

-- CreateIndex
CREATE UNIQUE INDEX "LocationAlias_alias_key" ON "LocationAlias"("alias");

-- CreateIndex
CREATE UNIQUE INDEX "Dealer_name_key" ON "Dealer"("name");

-- CreateIndex
CREATE INDEX "RateCard_originId_destinationKey_idx" ON "RateCard"("originId", "destinationKey");

-- CreateIndex
CREATE UNIQUE INDEX "RateCard_originId_destinationKey_effectiveFrom_key" ON "RateCard"("originId", "destinationKey", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "DieselRate_effectiveFrom_key" ON "DieselRate"("effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "Trip_lrNo_key" ON "Trip"("lrNo");

-- CreateIndex
CREATE INDEX "Trip_monthKey_idx" ON "Trip"("monthKey");

-- CreateIndex
CREATE INDEX "Trip_vehicleId_tripDate_idx" ON "Trip"("vehicleId", "tripDate");

-- CreateIndex
CREATE INDEX "Trip_driverId_tripDate_idx" ON "Trip"("driverId", "tripDate");

-- CreateIndex
CREATE INDEX "TripStop_locationId_idx" ON "TripStop"("locationId");

-- CreateIndex
CREATE UNIQUE INDEX "TripStop_tripId_seq_key" ON "TripStop"("tripId", "seq");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_usualDriverId_fkey" FOREIGN KEY ("usualDriverId") REFERENCES "Driver"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverAlias" ADD CONSTRAINT "DriverAlias_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LocationAlias" ADD CONSTRAINT "LocationAlias_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RateCard" ADD CONSTRAINT "RateCard_originId_fkey" FOREIGN KEY ("originId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_originId_fkey" FOREIGN KEY ("originId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "Dealer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripStop" ADD CONSTRAINT "TripStop_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripStop" ADD CONSTRAINT "TripStop_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
