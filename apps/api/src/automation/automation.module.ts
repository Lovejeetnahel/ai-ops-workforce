import { Module } from '@nestjs/common';
import { AutomationService } from './automation.service';
import { ActionHandlers } from './action-handlers';
import { ActionWorker } from './action.worker';
import { AutomationController } from './automation.controller';
import { AgentsModule } from '../agents/agents.module';

/**
 * Wires the consumer side of the event-driven core: the worker that drains the
 * BullMQ queue, the rule resolver, and the action handlers. EventBus itself
 * lives in the global EventBusModule. AgentsModule is imported so actions can
 * trigger agents; IntegrationsModule is global so CommsService is available.
 */
@Module({
  imports: [AgentsModule],
  controllers: [AutomationController],
  providers: [AutomationService, ActionHandlers, ActionWorker],
  exports: [AutomationService],
})
export class AutomationModule {}
