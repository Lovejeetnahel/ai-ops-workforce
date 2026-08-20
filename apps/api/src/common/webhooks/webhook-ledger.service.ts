import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const MAX_ATTEMPTS = 5;

/**
 * Sprint 4 webhook reliability center. Every provider webhook is recorded
 * here BEFORE processing (idempotency by `${provider}:${eventId}`), then the
 * outcome is written back. Retries re-run the stored provider payload through
 * the original handler; after MAX_ATTEMPTS a delivery is DEAD_LETTER until a
 * human resolves it. Payload = the provider's JSON body only — request
 * headers, signatures and secrets are never stored or displayed.
 */
@Injectable()
export class WebhookLedgerService {
  private readonly logger = new Logger(WebhookLedgerService.name);
  /** Handlers registered by webhook controllers, keyed by provider. */
  private readonly retryHandlers = new Map<string, (delivery: any) => Promise<unknown>>();

  constructor(private readonly prisma: PrismaService) {}

  registerRetryHandler(provider: string, handler: (delivery: any) => Promise<unknown>) {
    this.retryHandlers.set(provider, handler);
  }

  /**
   * Record an incoming delivery. Returns { duplicate: true } when this exact
   * provider event was already recorded — the caller must skip processing.
   */
  async record(input: { provider: string; eventType: string; eventId: string; tenantId?: string | null; entity?: string; entityId?: string; payload: unknown }) {
    const idempotencyKey = `${input.provider}:${input.eventId}`;
    try {
      const delivery = await this.prisma.webhookDelivery.create({
        data: {
          provider: input.provider,
          eventType: input.eventType,
          idempotencyKey,
          tenantId: input.tenantId ?? null,
          entity: input.entity ?? null,
          entityId: input.entityId ?? null,
          payload: (input.payload ?? {}) as any,
          attempts: 1,
        },
      });
      return { duplicate: false as const, delivery };
    } catch (err: any) {
      if (err?.code === 'P2002') {
        const delivery = await this.prisma.webhookDelivery.findUnique({ where: { idempotencyKey } });
        return { duplicate: true as const, delivery };
      }
      throw err;
    }
  }

  async markProcessed(id: string, patch: { tenantId?: string | null; entity?: string; entityId?: string } = {}) {
    await this.prisma.webhookDelivery.update({
      where: { id },
      data: { state: 'PROCESSED', processedAt: new Date(), lastError: null, ...patch },
    });
  }

  async markSkipped(id: string, reason: string) {
    await this.prisma.webhookDelivery.update({
      where: { id },
      data: { state: 'SKIPPED', processedAt: new Date(), lastError: reason.slice(0, 300) },
    });
  }

  async markFailed(id: string, error: Error | string) {
    const delivery = await this.prisma.webhookDelivery.findUnique({ where: { id } });
    if (!delivery) return;
    const state = delivery.attempts >= MAX_ATTEMPTS ? 'DEAD_LETTER' : 'FAILED';
    await this.prisma.webhookDelivery.update({
      where: { id },
      data: { state, lastError: String(typeof error === 'string' ? error : error.message).slice(0, 300) },
    });
  }

  /** Admin list — platform-wide or per tenant. No secrets in payloads. */
  list(filter: { tenantId?: string; provider?: string; state?: string; limit?: number } = {}) {
    return this.prisma.webhookDelivery.findMany({
      where: {
        ...(filter.tenantId ? { tenantId: filter.tenantId } : {}),
        ...(filter.provider ? { provider: filter.provider } : {}),
        ...(filter.state ? { state: filter.state } : {}),
      },
      orderBy: { receivedAt: 'desc' },
      take: Math.max(1, Math.min(200, filter.limit ?? 50)),
    });
  }

  /** Safe retry: re-runs the stored payload through the registered handler. */
  async retry(id: string) {
    const delivery = await this.prisma.webhookDelivery.findUnique({ where: { id } });
    if (!delivery) return { ok: false, error: 'Delivery not found' };
    if (delivery.state === 'PROCESSED') return { ok: true, note: 'Already processed — retry skipped (idempotent).' };
    const handler = this.retryHandlers.get(delivery.provider);
    if (!handler) return { ok: false, error: `No retry handler registered for provider ${delivery.provider}` };
    await this.prisma.webhookDelivery.update({ where: { id }, data: { attempts: { increment: 1 }, state: 'RECEIVED' } });
    try {
      await handler(delivery);
      await this.markProcessed(id);
      return { ok: true };
    } catch (err) {
      await this.markFailed(id, err as Error);
      this.logger.warn(`Webhook retry ${id} failed: ${(err as Error).message}`);
      return { ok: false, error: (err as Error).message?.slice(0, 200) };
    }
  }

  /** Human resolution for dead-lettered/failed deliveries. */
  async resolve(id: string, note?: string) {
    await this.prisma.webhookDelivery.update({
      where: { id },
      data: { state: 'RESOLVED', lastError: note?.slice(0, 300) ?? null, processedAt: new Date() },
    });
    return { ok: true };
  }
}
