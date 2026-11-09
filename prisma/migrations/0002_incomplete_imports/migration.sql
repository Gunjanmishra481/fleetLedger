-- AlterTable
ALTER TABLE "Trip" ADD COLUMN     "incomplete" TEXT,
ALTER COLUMN "vehicleId" DROP NOT NULL,
ALTER COLUMN "originId" DROP NOT NULL;
