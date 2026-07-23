import { Module } from '@nestjs/common';
import { EnterpriseModule } from '../enterprise/enterprise.module';
import { BusinessBrainController } from './business-brain.controller';
import { CompanyProfileService } from './company-profile.service';
import { GoalsService } from './goals.service';
import { KpisService } from './kpis.service';
import { ExecutiveService } from './executive.service';

/**
 * Business Brain (Sprint 1): structured company truth — profile, goals, KPIs
 * and the executive dashboard. Composes the EXISTING systems rather than
 * duplicating them: metric values come from EnterpriseModule's
 * AnalyticsService, free-text knowledge stays in the Brain module
 * (KnowledgeDoc RAG), and agent grounding reads these tables directly in
 * BusinessBrainService.companyFacts().
 */
@Module({
  imports: [EnterpriseModule],
  controllers: [BusinessBrainController],
  providers: [CompanyProfileService, GoalsService, KpisService, ExecutiveService],
  exports: [GoalsService],
})
export class BusinessBrainModule {}
