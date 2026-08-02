-- NOTE: HNSW DROP INDEX statements removed by hand (10th occurrence). DO NOT re-add.

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "locationId" TEXT,
ADD COLUMN     "serviceId" TEXT;

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "locationId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "locationId" TEXT;
