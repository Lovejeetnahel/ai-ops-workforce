import { Global, Module } from '@nestjs/common';
import { EventBus } from './event-bus';

/**
 * EventBus is global so any module (agents, leads, jobs, webhooks) can emit
 * domain events without importing AutomationModule — which keeps the agent ↔
 * automation relationship acyclic.
 */
@Global()
@Module({
  providers: [EventBus],
  exports: [EventBus],
})
export class EventBusModule {}
