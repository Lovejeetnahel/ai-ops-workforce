-- CreateEnum
CREATE TYPE "GoalStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'ACHIEVED', 'MISSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "GoalPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "KpiDirection" AS ENUM ('UP_IS_GOOD', 'DOWN_IS_GOOD');

-- NOTE: prisma migrate dev auto-generated DROP INDEX statements for the two
-- raw-SQL pgvector HNSW indexes (EntityMemory_embedding_hnsw_idx,
-- KnowledgeChunk_embedding_hnsw_idx) as false-positive drift — removed by
-- hand, as in every prior migration (7th occurrence).

-- AlterTable
ALTER TABLE "AgentInstallation" ALTER COLUMN "authority" SET DEFAULT 'APPROVE';

-- AlterTable
ALTER TABLE "AgentTask" ADD COLUMN     "goalId" TEXT;

-- CreateTable
CREATE TABLE "CompanyProfile" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "legalName" TEXT,
    "brandName" TEXT,
    "tagline" TEXT,
    "mission" TEXT,
    "vision" TEXT,
    "brandVoice" TEXT,
    "targetMarket" TEXT,
    "workingHours" JSONB NOT NULL DEFAULT '{}',
    "locations" JSONB NOT NULL DEFAULT '[]',
    "businessRules" JSONB NOT NULL DEFAULT '[]',
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Goal" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "priority" "GoalPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "GoalStatus" NOT NULL DEFAULT 'ACTIVE',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "department" TEXT,
    "ownerUserId" TEXT,
    "agentKeys" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "parentGoalId" TEXT,
    "startAt" TIMESTAMP(3),
    "dueAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Goal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Kpi" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT,
    "direction" "KpiDirection" NOT NULL DEFAULT 'UP_IS_GOOD',
    "metricKey" TEXT,
    "currentValue" DOUBLE PRECISION,
    "targetValue" DOUBLE PRECISION,
    "goalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Kpi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KpiSnapshot" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "kpiId" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KpiSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CompanyProfile_tenantId_key" ON "CompanyProfile"("tenantId");

-- CreateIndex
CREATE INDEX "Goal_tenantId_status_priority_idx" ON "Goal"("tenantId", "status", "priority");

-- CreateIndex
CREATE INDEX "Goal_tenantId_parentGoalId_idx" ON "Goal"("tenantId", "parentGoalId");

-- CreateIndex
CREATE INDEX "Goal_tenantId_department_idx" ON "Goal"("tenantId", "department");

-- CreateIndex
CREATE INDEX "Kpi_tenantId_goalId_idx" ON "Kpi"("tenantId", "goalId");

-- CreateIndex
CREATE INDEX "KpiSnapshot_tenantId_kpiId_capturedAt_idx" ON "KpiSnapshot"("tenantId", "kpiId", "capturedAt");

-- CreateIndex
CREATE INDEX "AgentTask_tenantId_goalId_idx" ON "AgentTask"("tenantId", "goalId");

-- AddForeignKey
ALTER TABLE "CompanyProfile" ADD CONSTRAINT "CompanyProfile_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Kpi" ADD CONSTRAINT "Kpi_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Kpi" ADD CONSTRAINT "Kpi_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "Goal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KpiSnapshot" ADD CONSTRAINT "KpiSnapshot_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KpiSnapshot" ADD CONSTRAINT "KpiSnapshot_kpiId_fkey" FOREIGN KEY ("kpiId") REFERENCES "Kpi"("id") ON DELETE CASCADE ON UPDATE CASCADE;
