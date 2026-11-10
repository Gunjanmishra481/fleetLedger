-- AlterTable
ALTER TABLE "Location" ADD COLUMN     "consignorId" INTEGER;

-- AlterTable
ALTER TABLE "Trip" ADD COLUMN     "invoiceId" INTEGER;

-- AlterTable
ALTER TABLE "Vehicle" ADD COLUMN     "model" TEXT;

-- CreateTable
CREATE TABLE "CompanyProfile" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "name" TEXT NOT NULL,
    "addressLines" TEXT[],
    "phone" TEXT,
    "contactNo" TEXT,
    "pan" TEXT,
    "gstin" TEXT,
    "state" TEXT,
    "stateCode" TEXT,
    "sacCode" TEXT,
    "bankBeneficiary" TEXT,
    "bankAccountNo" TEXT,
    "bankIfsc" TEXT,
    "bankName" TEXT,
    "invoicePrefix" TEXT NOT NULL DEFAULT 'INV',
    "transporterShortName" TEXT,
    "invoiceSeriesFy" TEXT,
    "invoiceSeriesStart" INTEGER,
    "signature" BYTEA,
    "signatureMime" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Consignor" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "billingName" TEXT NOT NULL,
    "addressLines" TEXT[],
    "gstin" TEXT,
    "pan" TEXT,
    "state" TEXT,
    "stateCode" TEXT,
    "handlingLabel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Consignor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TripVin" (
    "id" SERIAL NOT NULL,
    "tripId" INTEGER NOT NULL,
    "seq" INTEGER NOT NULL,
    "vin" TEXT NOT NULL,
    "model" TEXT,
    "oem" TEXT,
    "region" TEXT,
    "dealerCode" TEXT,
    "dealerName" TEXT,
    "dealerLocation" TEXT,
    "oemInvoiceDate" TEXT,
    "oemInvoiceNo" TEXT,
    "lotNo" TEXT,
    "loafNo" TEXT,
    "lastMileTpt" TEXT,
    "carrierNo" TEXT,
    "dispatchDate" DATE,

    CONSTRAINT "TripVin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" SERIAL NOT NULL,
    "number" TEXT,
    "fy" TEXT,
    "seq" INTEGER,
    "consignorId" INTEGER NOT NULL,
    "invoiceDate" DATE NOT NULL,
    "period" TEXT NOT NULL,
    "placeOfSupply" TEXT NOT NULL,
    "subtotal" INTEGER NOT NULL,
    "igst" INTEGER NOT NULL,
    "cgst" INTEGER NOT NULL,
    "sgst" INTEGER NOT NULL,
    "roundOff" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "seller" TEXT,
    "buyer" TEXT,
    "lines" TEXT,
    "vinRows" TEXT,
    "createdBy" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Consignor_name_key" ON "Consignor"("name");

-- CreateIndex
CREATE UNIQUE INDEX "TripVin_vin_key" ON "TripVin"("vin");

-- CreateIndex
CREATE INDEX "TripVin_tripId_idx" ON "TripVin"("tripId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_number_key" ON "Invoice"("number");

-- CreateIndex
CREATE INDEX "Invoice_consignorId_status_idx" ON "Invoice"("consignorId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_fy_seq_key" ON "Invoice"("fy", "seq");

-- CreateIndex
CREATE INDEX "Trip_invoiceId_idx" ON "Trip"("invoiceId");

-- AddForeignKey
ALTER TABLE "Location" ADD CONSTRAINT "Location_consignorId_fkey" FOREIGN KEY ("consignorId") REFERENCES "Consignor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripVin" ADD CONSTRAINT "TripVin_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_consignorId_fkey" FOREIGN KEY ("consignorId") REFERENCES "Consignor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
