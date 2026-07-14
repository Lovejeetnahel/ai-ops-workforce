-- CreateEnum
CREATE TYPE "ContactSubmissionStatus" AS ENUM ('NEW', 'READ', 'RESOLVED');

-- AlterTable
ALTER TABLE "PublicContactSubmission" ADD COLUMN     "status" "ContactSubmissionStatus" NOT NULL DEFAULT 'NEW';

-- CreateIndex
CREATE INDEX "PublicContactSubmission_status_createdAt_idx" ON "PublicContactSubmission"("status", "createdAt");
