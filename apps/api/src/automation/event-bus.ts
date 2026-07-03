import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { randomUUID } from 'node:crypto';
import { DomainEvent } from './events';
import { PrismaService } from '../common/prisma/prisma.service';

export const AUTOMATION_QUEUE = 'automation';

/**
 * The event bus has two faces:
 *
 *  • In-process listeners for low-latency, SAME-REQUEST reactions (the AI
 *    Workforce router, Activity/Notification projectors, Workflow router).
 *  • A durable BullMQ queue so automation ACTIONS (network calls, retries,
 *    delays) run in the worker process and survive restarts.
 *
 * Every emit is also written to EventLog, which doubles as the idempotency
 * ledger: a duplicate provider webhook (same source+externalId) is dropped.
 *
 * IMPORTANT (found via live verification, a real reproduced bug): in-process
 * listeners are AWAITED by `emit()`, not fire-and-forgotten. The original
 * implementation used Node's `EventEmitter`, whose `.emit()` does not await
 * async listeners — so a listener like the AI Workforce router (which creates
 * a DecisionRecord asynchronously) could still be running when a SUBSEQUENT,
 * synchronously-chained event (e.g. dispatch emitting `job.assigned` right
 * after `lead.created`) was already fully processed by the worker. The
 * decision's `expectedSignal` had already passed by the time it was created,
 * so it could never resolve and would sit OPEN until its 168h deadline swept
 * it to MISSED — incorrectly recording a real, successful outcome as a miss.
 * Reproduced with a 240ms gap between `job.assigned` firing and the decision
 * being created. Awaiting listeners here closes that race for every current
 * and future in-process consumer, not just the one that exposed it.
 */
@Injectable()
export class EventBus {
  private readonly logger = new Logger(EventBus.name);
  private readonly handlers = new Map<string, Array<(e: DomainEvent) => unknown>>();
  private readonly connection = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
  });
  readonly queue = new Queue(AUTOMATION_QUEUE, { connection: this.connection });

  constructor(private readonly prisma: PrismaService) {}

  /** In-process subscription for same-request reactors. Awaited by emit(). */
  on(eventName: string, handler: (e: DomainEvent) => unknown) {
    const list = this.handlers.get(eventName) ?? [];
    list.push(handler);
    this.handlers.set(eventName, list);
  }

  /** Run every in-process listener for this event, isolated and awaited. */
  private async fanOutInProcess(event: DomainEvent): Promise<void> {
    const list = this.handlers.get(event.name);
    if (!list?.length) return;
    await Promise.all(
      list.map((handler) =>
        Promise.resolve()
          .then(() => handler(event))
          .catch((err) => this.logger.warn(`in-process handler failed for ${event.name}: ${(err as Error).message}`)),
      ),
    );
  }

  /**
   * Publish a domain event. Returns false if it was a duplicate webhook and was
   * deduped. Otherwise: persists to EventLog, fans out in-process, and enqueues
   * the rule-evaluation job for the worker.
   */
  async emit(event: DomainEvent): Promise<boolean> {
    const occurredAt = event.occurredAt ?? new Date().toISOString();
    // Correlate every decision spawned by this event (control-layer idempotency).
    event.correlationId = event.correlationId ?? randomUUID();

    // Idempotency: unique (tenantId, source, externalId).
    if (event.externalId) {
      try {
        await this.prisma.eventLog.create({
          data: {
            tenantId: event.tenantId,
            name: event.name,
            source: event.source ?? 'internal',
            externalId: event.externalId,
            payload: event.payload as any,
          },
        });
      } catch (err: any) {
        if (err?.code === 'P2002') {
          this.logger.debug(`Duplicate event dropped: ${event.name}/${event.externalId}`);
          return false;
        }
        throw err;
      }
    } else {
      await this.prisma.eventLog.create({
        data: {
          tenantId: event.tenantId,
          name: event.name,
          source: event.source ?? 'internal',
          payload: event.payload as any,
        },
      });
    }

    await this.fanOutInProcess({ ...event, occurredAt });

    await this.queue.add(
      'evaluate',
      { ...event, occurredAt },
      { attempts: 5, backoff: { type: 'exponential', delay: 2000 }, removeOnComplete: 1000 },
    );

    this.logger.debug(`emit ${event.name} (tenant=${event.tenantId})`);
    return true;
  }
}
