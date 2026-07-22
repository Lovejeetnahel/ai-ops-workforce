import { Module } from '@nestjs/common';
import { AgentsModule } from '../agents/agents.module';
import { OperationsModule } from '../operations/operations.module';
import { RevenueModule } from '../revenue/revenue.module';
import { EmployeeKit } from './framework/employee-kit.service';
import { ToolRegistry } from './framework/tool-registry.service';
import { ToolGateway } from './framework/tool-gateway.service';
import { AiUsageService } from './framework/ai-usage.service';
import { AgentApprovalsService } from './framework/agent-approvals.service';
import { CommandRateLimitGuard } from './command-rate-limit.guard';
import { EmployeeRegistry } from './framework/employee-registry.service';
import { AgentOrchestrator } from './framework/agent-orchestrator.service';
import { EmployeeMetricsService } from './framework/employee-metrics.service';
import { EmployeeEventRouter } from './framework/employee-event-router.service';
import { EmployeeSchedulerService } from './framework/employee-scheduler.service';
import { EmployeeController } from './employee.controller';
import { SalesEmployee } from './roster/sales.employee';
import { CustomerSuccessEmployee } from './roster/customer-success.employee';
import { CollectionsEmployee } from './roster/collections.employee';
import { RecruitingEmployee } from './roster/recruiting.employee';
import { OperationsManagerEmployee } from './roster/operations-manager.employee';
import { MarketingEmployee } from './roster/marketing.employee';
import { ReceptionistEmployee } from './roster/receptionist.employee';
import { ExecutiveEmployee } from './roster/executive.employee';
import { CommandCenterEmployee } from './roster/command-center.employee';

/**
 * AI Workforce (Phase 6). Installable AI employees on a shared framework that
 * reuses Brain, Control Layer, Operations, Revenue, the existing AgentRegistry,
 * and the EventBus. Imports the modules whose services the tools/employees call;
 * everything else is global. No previous module is modified.
 */
@Module({
  imports: [AgentsModule, OperationsModule, RevenueModule],
  controllers: [EmployeeController],
  providers: [
    EmployeeKit,
    ToolRegistry,
    ToolGateway,
    AiUsageService,
    AgentApprovalsService,
    CommandRateLimitGuard,
    EmployeeRegistry,
    AgentOrchestrator,
    EmployeeMetricsService,
    EmployeeEventRouter,
    EmployeeSchedulerService,
    SalesEmployee,
    CustomerSuccessEmployee,
    CollectionsEmployee,
    RecruitingEmployee,
    OperationsManagerEmployee,
    MarketingEmployee,
    ReceptionistEmployee,
    ExecutiveEmployee,
    CommandCenterEmployee,
  ],
  exports: [AgentOrchestrator, EmployeeRegistry],
})
export class EmployeesModule {}
