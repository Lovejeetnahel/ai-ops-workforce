-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CampaignChannel" AS ENUM ('SMS', 'EMAIL');

-- CreateEnum
CREATE TYPE "CampaignRecipientStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "SocialPostStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SCHEDULED', 'PUBLISHED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReviewSource" AS ENUM ('GOOGLE', 'FACEBOOK', 'YELP', 'DIRECT', 'OTHER');

-- CreateEnum
CREATE TYPE "ReviewResponseStatus" AS ENUM ('NEEDS_RESPONSE', 'DRAFTED', 'RESPONDED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "ReviewRequestStatus" AS ENUM ('DRAFT', 'SENT', 'FAILED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "AttributionKind" AS ENUM ('DIRECT', 'ASSISTED', 'ESTIMATED', 'UNATTRIBUTED', 'UNKNOWN');

-- NOTE: prisma diff again tried to drop the two pgvector HNSW indexes
-- (EntityMemory_embedding_hnsw_idx, KnowledgeChunk_embedding_hnsw_idx)
-- because they are raw-SQL managed outside the Prisma schema. Removed by
-- hand, as in every prior migration. DO NOT re-add those DROP INDEX lines.

-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "agentKey" TEXT,
ADD COLUMN     "assignedToId" TEXT,
ADD COLUMN     "closedAt" TIMESTAMP(3),
ADD COLUMN     "lastMessageAt" TIMESTAMP(3),
ADD COLUMN     "subject" TEXT,
ADD COLUMN     "unread" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "actualValue" DECIMAL(12,2),
ADD COLUMN     "campaignId" TEXT,
ADD COLUMN     "wonAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "isInternal" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ValueLedgerEntry" ADD COLUMN     "attribution" "AttributionKind" NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN     "campaignId" TEXT;

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "channel" "CampaignChannel" NOT NULL,
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "subject" TEXT,
    "content" TEXT NOT NULL DEFAULT '',
    "audience" JSONB NOT NULL DEFAULT '{}',
    "goalId" TEXT,
    "isTemplate" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "scheduledAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "meta" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignRecipient" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "status" "CampaignRecipientStatus" NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialPost" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "caption" TEXT NOT NULL DEFAULT '',
    "mediaRefs" JSONB NOT NULL DEFAULT '[]',
    "status" "SocialPostStatus" NOT NULL DEFAULT 'DRAFT',
    "scheduledFor" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "publishNote" TEXT,
    "campaignId" TEXT,
    "goalId" TEXT,
    "assignedToId" TEXT,
    "agentKey" TEXT,
    "createdById" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "meta" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewRequest" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "channel" "Channel" NOT NULL DEFAULT 'SMS',
    "message" TEXT NOT NULL,
    "status" "ReviewRequestStatus" NOT NULL DEFAULT 'DRAFT',
    "jobId" TEXT,
    "sentAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReviewRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "contactId" TEXT,
    "requestId" TEXT,
    "source" "ReviewSource" NOT NULL DEFAULT 'DIRECT',
    "rating" INTEGER NOT NULL,
    "text" TEXT,
    "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responseStatus" "ReviewResponseStatus" NOT NULL DEFAULT 'NEEDS_RESPONSE',
    "responseDraft" TEXT,
    "responseText" TEXT,
    "respondedAt" TIMESTAMP(3),
    "respondedById" TEXT,
    "followUpActivityId" TEXT,
    "meta" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Campaign_tenantId_status_idx" ON "Campaign"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Campaign_tenantId_isTemplate_idx" ON "Campaign"("tenantId", "isTemplate");

-- CreateIndex
CREATE INDEX "CampaignRecipient_tenantId_campaignId_status_idx" ON "CampaignRecipient"("tenantId", "campaignId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignRecipient_campaignId_contactId_key" ON "CampaignRecipient"("campaignId", "contactId");

-- CreateIndex
CREATE INDEX "SocialPost_tenantId_status_idx" ON "SocialPost"("tenantId", "status");

-- CreateIndex
CREATE INDEX "SocialPost_tenantId_scheduledFor_idx" ON "SocialPost"("tenantId", "scheduledFor");

-- CreateIndex
CREATE INDEX "ReviewRequest_tenantId_status_idx" ON "ReviewRequest"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Review_tenantId_responseStatus_idx" ON "Review"("tenantId", "responseStatus");

-- CreateIndex
CREATE INDEX "Review_tenantId_rating_idx" ON "Review"("tenantId", "rating");

-- CreateIndex
CREATE INDEX "Review_tenantId_reviewedAt_idx" ON "Review"("tenantId", "reviewedAt");

-- CreateIndex
CREATE INDEX "Conversation_tenantId_assignedToId_idx" ON "Conversation"("tenantId", "assignedToId");

-- CreateIndex
CREATE INDEX "Conversation_tenantId_unread_idx" ON "Conversation"("tenantId", "unread");

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignRecipient" ADD CONSTRAINT "CampaignRecipient_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignRecipient" ADD CONSTRAINT "CampaignRecipient_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignRecipient" ADD CONSTRAINT "CampaignRecipient_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialPost" ADD CONSTRAINT "SocialPost_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewRequest" ADD CONSTRAINT "ReviewRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewRequest" ADD CONSTRAINT "ReviewRequest_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ReviewRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
