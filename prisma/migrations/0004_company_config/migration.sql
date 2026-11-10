-- DropTable
DROP TABLE "CompanyProfile";

-- CreateTable
CREATE TABLE "InvoiceSeries" (
    "fy" TEXT NOT NULL,
    "startNo" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvoiceSeries_pkey" PRIMARY KEY ("fy")
);

-- Continue the existing series: invoice MKLAMD2627108 was the last one issued in FY 2026-27.
INSERT INTO "InvoiceSeries" ("fy", "startNo", "updatedAt") VALUES ('2627', 109, CURRENT_TIMESTAMP)
ON CONFLICT ("fy") DO NOTHING;
