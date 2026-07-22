-- CreateEnum
CREATE TYPE "AgentApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'EXECUTED', 'FAILED');

-- AlterTable
ALTER TABLE "AgentInstallation" ADD COLUMN     "lastRunAt" TIMESTAMP(3),
ADD COLUMN     "nextRunAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "AgentTask" ADD COLUMN     "costMicros" BIGINT,
ADD COLUMN     "tokensIn" INTEGER,
ADD COLUMN     "tokensOut" INTEGER;

-- CreateTable
CREATE TABLE "AgentApproval" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "agentKey" TEXT NOT NULL,
    "taskId" TEXT,
    "toolName" TEXT NOT NULL,
    "toolArgs" JSONB NOT NULL DEFAULT '{}',
    "reason" TEXT,
    "confidence" DOUBLE PRECISION,
    "authority" "AgentAuthority" NOT NULL,
    "status" "AgentApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "executedAt" TIMESTAMP(3),
    "executionResult" JSONB,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiUsageEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "tokensIn" INTEGER NOT NULL,
    "tokensOut" INTEGER NOT NULL,
    "costMicros" BIGINT,
    "agentKey" TEXT,
    "taskId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiUsageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AgentApproval_idempotencyKey_key" ON "AgentApproval"("idempotencyKey");

-- CreateIndex
CREATE INDEX "AgentApproval_tenantId_status_expiresAt_idx" ON "AgentApproval"("tenantId", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "AgentApproval_tenantId_createdAt_idx" ON "AgentApproval"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "AgentApproval_tenantId_agentKey_idx" ON "AgentApproval"("tenantId", "agentKey");

-- CreateIndex
CREATE INDEX "AiUsageEvent_tenantId_createdAt_idx" ON "AiUsageEvent"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "AiUsageEvent_tenantId_agentKey_createdAt_idx" ON "AiUsageEvent"("tenantId", "agentKey", "createdAt");

-- CreateIndex
CREATE INDEX "AgentInstallation_nextRunAt_idx" ON "AgentInstallation"("nextRunAt");

-- AddForeignKey
ALTER TABLE "AgentApproval" ADD CONSTRAINT "AgentApproval_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiUsageEvent" ADD CONSTRAINT "AiUsageEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
