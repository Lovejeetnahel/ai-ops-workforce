import { Module } from '@nestjs/common';
import { EmployeesModule } from '../employees/employees.module';
import { AnalyticsService } from './analytics/analytics.service';
import { AnalyticsController } from './analytics/analytics.controller';
import { PredictionService } from './intelligence/prediction.service';
import { BriefingService } from './intelligence/briefing.service';
import { IntelligenceController } from './intelligence/intelligence.controller';
import { ReportService } from './reporting/report.service';
import { ReportingController } from './reporting/reporting.controller';
import { LearningService } from './learning/learning.service';
import { LearningController } from './learning/learning.controller';
import { OrganizationService } from './organizations/organization.service';
import { OrganizationsController } from './organizations/organizations.controller';
import { ComplianceService } from './compliance/compliance.service';
import { ComplianceController } from './compliance/compliance.controller';
import { WebhookService } from './integrations-platform/webhook.service';
import { IntegrationsPlatformController } from './integrations-platform/integrations-platform.controller';
import { ApiKeyService } from './api-platform/api-key.service';
import { ApiKeyController } from './api-platform/api-key.controller';
import { ApiScopeGuard } from './api-platform/api-scope.guard';
import { PublicApiController } from './api-platform/public-api.controller';
import { WorkflowEngine } from './workflows/workflow-engine.service';
import { WorkflowService } from './workflows/workflow.service';
import { WorkflowRouter } from './workflows/workflow-router.service';
import { WorkflowsController } from './workflows/workflows.controller';

/**
 * Enterprise Intelligence & Platform (Phase 7): analytics/KPIs, predictive
 * intelligence, reporting, executive briefing, learning, multi-company,
 * compliance, integration/webhooks, API platform, and the visual workflow
 * engine. Imports EmployeesModule (the workflow engine runs AI nodes through the
 * AI Workforce orchestrator); everything else is global. No prior module changed.
 */
@Module({
  imports: [EmployeesModule],
  controllers: [
    AnalyticsController,
    IntelligenceController,
    ReportingController,
    LearningController,
    OrganizationsController,
    ComplianceController,
    IntegrationsPlatformController,
    ApiKeyController,
    PublicApiController,
    WorkflowsController,
  ],
  providers: [
    AnalyticsService,
    PredictionService,
    BriefingService,
    ReportService,
    LearningService,
    OrganizationService,
    ComplianceService,
    WebhookService,
    ApiKeyService,
    ApiScopeGuard,
    WorkflowEngine,
    WorkflowService,
    WorkflowRouter,
  ],
  exports: [AnalyticsService, PredictionService],
})
export class EnterpriseModule {}
