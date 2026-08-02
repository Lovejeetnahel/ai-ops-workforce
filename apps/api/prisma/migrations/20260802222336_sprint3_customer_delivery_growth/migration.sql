-- CreateEnum
CREATE TYPE "VoiceAgentMode" AS ENUM ('INBOUND', 'OUTBOUND', 'BOTH');

-- CreateEnum
CREATE TYPE "CallStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'FAILED', 'NO_ANSWER', 'HANDED_OFF');

-- CreateEnum
CREATE TYPE "SitePageStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "StaffNotificationPriority" AS ENUM ('NORMAL', 'HIGH');

-- NOTE: HNSW DROP INDEX statements removed by hand (9th occurrence) — raw-SQL
-- managed pgvector indexes, DO NOT re-add.

-- CreateTable
CREATE TABLE "VoiceAgent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "purpose" TEXT,
    "mode" "VoiceAgentMode" NOT NULL DEFAULT 'INBOUND',
    "greeting" TEXT,
    "instructions" TEXT,
    "businessHours" JSONB NOT NULL DEFAULT '{}',
    "recordingConsentRequired" BOOLEAN NOT NULL DEFAULT true,
    "consentScript" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "locationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VoiceAgent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallRecord" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "voiceAgentId" TEXT,
    "conversationId" TEXT,
    "contactId" TEXT,
    "direction" "MessageDirection" NOT NULL DEFAULT 'INBOUND',
    "status" "CallStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "durationSec" INTEGER,
    "summary" TEXT,
    "outcome" TEXT,
    "recordingUrl" TEXT,
    "consentGiven" BOOLEAN,
    "costUsd" DECIMAL(10,4),
    "externalRef" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "meta" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "CallRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceOffering" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "durationMin" INTEGER NOT NULL DEFAULT 60,
    "priceCents" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "locationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceOffering_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingLink" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "serviceId" TEXT,
    "staffUserId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookingLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Site" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "customDomain" TEXT,
    "domainStatus" TEXT NOT NULL DEFAULT 'not_connected',
    "theme" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Site_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SitePage" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "sections" JSONB NOT NULL DEFAULT '[]',
    "seo" JSONB NOT NULL DEFAULT '{}',
    "status" "SitePageStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SitePage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SitePageRevision" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "sections" JSONB NOT NULL,
    "seo" JSONB NOT NULL DEFAULT '{}',
    "savedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SitePageRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormSubmission" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "pageId" TEXT,
    "data" JSONB NOT NULL DEFAULT '{}',
    "leadId" TEXT,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FormSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeoAudit" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "siteId" TEXT,
    "score" INTEGER NOT NULL,
    "results" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeoAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Location" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "timezone" TEXT,
    "businessHours" JSONB NOT NULL DEFAULT '{}',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffNotification" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "href" TEXT,
    "priority" "StaffNotificationPriority" NOT NULL DEFAULT 'NORMAL',
    "read" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "sourceEvent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VoiceAgent_tenantId_enabled_idx" ON "VoiceAgent"("tenantId", "enabled");

-- CreateIndex
CREATE INDEX "CallRecord_tenantId_startedAt_idx" ON "CallRecord"("tenantId", "startedAt");

-- CreateIndex
CREATE INDEX "CallRecord_tenantId_status_idx" ON "CallRecord"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CallRecord_tenantId_externalRef_key" ON "CallRecord"("tenantId", "externalRef");

-- CreateIndex
CREATE INDEX "ServiceOffering_tenantId_active_idx" ON "ServiceOffering"("tenantId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "BookingLink_slug_key" ON "BookingLink"("slug");

-- CreateIndex
CREATE INDEX "BookingLink_tenantId_active_idx" ON "BookingLink"("tenantId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "Site_slug_key" ON "Site"("slug");

-- CreateIndex
CREATE INDEX "Site_tenantId_idx" ON "Site"("tenantId");

-- CreateIndex
CREATE INDEX "SitePage_tenantId_status_idx" ON "SitePage"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SitePage_siteId_slug_key" ON "SitePage"("siteId", "slug");

-- CreateIndex
CREATE INDEX "SitePageRevision_tenantId_pageId_createdAt_idx" ON "SitePageRevision"("tenantId", "pageId", "createdAt");

-- CreateIndex
CREATE INDEX "FormSubmission_tenantId_createdAt_idx" ON "FormSubmission"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "SeoAudit_tenantId_createdAt_idx" ON "SeoAudit"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "Location_tenantId_active_idx" ON "Location"("tenantId", "active");

-- CreateIndex
CREATE INDEX "StaffNotification_tenantId_userId_read_createdAt_idx" ON "StaffNotification"("tenantId", "userId", "read", "createdAt");

-- CreateIndex
CREATE INDEX "StaffNotification_tenantId_createdAt_idx" ON "StaffNotification"("tenantId", "createdAt");

-- AddForeignKey
ALTER TABLE "VoiceAgent" ADD CONSTRAINT "VoiceAgent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallRecord" ADD CONSTRAINT "CallRecord_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallRecord" ADD CONSTRAINT "CallRecord_voiceAgentId_fkey" FOREIGN KEY ("voiceAgentId") REFERENCES "VoiceAgent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceOffering" ADD CONSTRAINT "ServiceOffering_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingLink" ADD CONSTRAINT "BookingLink_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingLink" ADD CONSTRAINT "BookingLink_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "ServiceOffering"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Site" ADD CONSTRAINT "Site_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SitePage" ADD CONSTRAINT "SitePage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SitePage" ADD CONSTRAINT "SitePage_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SitePageRevision" ADD CONSTRAINT "SitePageRevision_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SitePageRevision" ADD CONSTRAINT "SitePageRevision_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "SitePage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormSubmission" ADD CONSTRAINT "FormSubmission_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormSubmission" ADD CONSTRAINT "FormSubmission_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "SitePage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeoAudit" ADD CONSTRAINT "SeoAudit_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Location" ADD CONSTRAINT "Location_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffNotification" ADD CONSTRAINT "StaffNotification_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
