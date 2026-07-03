import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { createHmac, randomBytes } from 'node:crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EventBus } from '../../automation/event-bus';
import { DomainEvent } from '../../automation/events';
import { tenantContext } from '../../common/tenancy/tenant-context';
import { CONNECTOR_CATALOG } from './connector-catalog';

/** Domain events offered to webhook subscribers (the public event surface). */
const WEBHOOK_EVENTS = [
  'lead.created', 'lead.stage_changed', 'booking.confirmed', 'job.assigned', 'job.completed',
  'document.generated', 'invoice.sent', 'payment.succeeded', 'customer.booking.requested',
  'agent.task_completed', 'prediction.created',
];

/**
 * Outbound webhook platform. Subscriptions fan out matching domain events to
 * external URLs with an HMAC-SHA256 signature (Zapier/Make/custom). Reuses the
 * EventBus — no polling, no new transport. Also serves the connector catalog.
 */
@Injectable()
export class WebhookService implements OnModuleInit {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly bus: EventBus,
  ) {}

  onModuleInit() {
    for (const name of WEBHOOK_EVENTS) this.bus.on(name, (e) => this.fanOut(name, e));
  }

  catalog() {
    return CONNECTOR_CATALOG;
  }

  subscribe(input: { url: string; events: string[] }) {
    this.assertSafeUrl(input.url);
    return this.prisma.db.webhookSubscription.create({
      data: { url: input.url, events: input.events, secret: `whsec_${randomBytes(16).toString('hex')}` } as any,
    });
  }

  /**
   * Block SSRF via webhook delivery. Rejects URLs resolving to private/loopback
   * ranges, link-local (169.254.x.x), and cloud-metadata addresses so a malicious
   * tenant cannot subscribe to events and then use webhook delivery to probe
   * internal network services or harvest cloud-provider IAM credentials.
   */
  private assertSafeUrl(rawUrl: string) {
    let parsed: URL;
    try { parsed = new URL(rawUrl); } catch { throw new BadRequestException('Invalid webhook URL'); }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:')
      throw new BadRequestException('Webhook URL must use http or https');
    const host = parsed.hostname.toLowerCase();
    // Reject loopback, private, and link-local by hostname
    const blocked = [
      /^localhost$/,
      /^127\./,
      /^10\./,
      /^172\.(1[6-9]|2\d|3[01])\./,
      /^192\.168\./,
      /^169\.254\./,   // link-local / AWS metadata
      /^::1$/,
      /^0\./,
      /^0\.0\.0\.0$/,
    ];
    if (blocked.some((re) => re.test(host)))
      throw new BadRequestException('Webhook URL must not target private/internal addresses');
  }

  list() {
    return this.prisma.db.webhookSubscription.findMany({ orderBy: { createdAt: 'desc' } });
  }

  remove(id: string) {
    return this.prisma.db.webhookSubscription.delete({ where: { id } });
  }

  private fanOut(eventName: string, event: DomainEvent) {
    // Returned (not void) so EventBus.emit() awaits this same-request reaction.
    return tenantContext.run({ tenantId: event.tenantId }, async () => {
      const subs = await this.prisma.db.webhookSubscription.findMany({ where: { active: true, events: { has: eventName } } });
      await Promise.all(subs.map((s) => this.deliver(s, eventName, event)));
    });
  }

  private async deliver(sub: { id: string; url: string; secret: string }, eventName: string, event: DomainEvent) {
    const body = JSON.stringify({ event: eventName, tenantId: event.tenantId, payload: event.payload, at: new Date().toISOString() });
    const signature = createHmac('sha256', sub.secret).update(body).digest('hex');
    const ok = await this.tryDeliver(sub, body, signature);
    if (!ok) {
      // Enqueue a durable BullMQ retry job. The body + signature are pre-computed
      // so the worker re-sends exactly what the receiver would have seen on the
      // first attempt. Persisted in Redis: survives API restarts unlike the
      // previous setTimeout-based approach, which silently dropped all pending
      // retries on process exit.
      await this.bus.queue.add(
        'webhook:deliver',
        { _type: 'webhook:deliver', tenantId: event.tenantId, subId: sub.id, url: sub.url, body, signature },
        { attempts: 4, backoff: { type: 'exponential', delay: 2000 } },
      );
    }
  }

  private async tryDeliver(sub: { id: string; url: string }, body: string, signature: string): Promise<boolean> {
    try {
      const res = await fetch(sub.url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-AIOW-Signature': signature }, body });
      if (!res.ok) throw new Error(`status ${res.status}`);
      return true;
    } catch (err) {
      this.logger.warn(`webhook ${sub.id} delivery failed: ${(err as Error).message}`);
      return false;
    }
  }
}
