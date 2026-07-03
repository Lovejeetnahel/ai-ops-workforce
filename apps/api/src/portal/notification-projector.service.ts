import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventBus } from '../automation/event-bus';
import { DomainEvent } from '../automation/events';
import { tenantContext } from '../common/tenancy/tenant-context';
import { NotificationsService, NOTIFICATION_EVENTS } from './notifications.service';

/**
 * Turns business events into customer notifications. Subscribes to the EventBus
 * (same pattern as the CRM ActivityProjector) so notifications are produced
 * automatically with zero coupling to the emitting services. Runs tenant-scoped
 * and best-effort — never affects the originating flow.
 */
@Injectable()
export class NotificationProjector implements OnModuleInit {
  private readonly logger = new Logger(NotificationProjector.name);

  constructor(
    private readonly bus: EventBus,
    private readonly notifications: NotificationsService,
  ) {}

  onModuleInit() {
    for (const name of NOTIFICATION_EVENTS) {
      this.bus.on(name, (event) => this.handle(name, event));
    }
    this.logger.log(`Notification projector listening on ${NOTIFICATION_EVENTS.length} event types`);
  }

  private handle(name: string, event: DomainEvent) {
    // Returned (not void) so EventBus.emit() awaits this same-request reaction.
    return tenantContext.run({ tenantId: event.tenantId }, async () => {
      try {
        await this.notifications.fromEvent(name, event);
      } catch (err) {
        this.logger.warn(`notification projection failed for ${name}: ${(err as Error).message}`);
      }
    });
  }
}
