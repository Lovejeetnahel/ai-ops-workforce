import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * AI usage accounting for the workforce. Tokens are the immutable facts,
 * recorded per LLM call with the exact provider + model (never merged into
 * one undifferentiated number). Money is only ever an ESTIMATE, derived from
 * operator-supplied pricing in the LLM_PRICING env var — no provider rates
 * are hardcoded in business logic, so stale prices can't silently lie.
 *
 * LLM_PRICING format (JSON, per-million-token prices in micros — i.e.
 * millionths of a currency unit; 1_000_000 micros = 1.00):
 *   {"claude-opus-4-8": {"inPerMTokMicros": 15000000, "outPerMTokMicros": 75000000}}
 * Unknown/absent model → costMicros null (tokens still recorded).
 */
export interface LlmCallUsage {
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  agentKey?: string;
  taskId?: string;
}

interface ModelPrice {
  inPerMTokMicros: number;
  outPerMTokMicros: number;
}

/** Pure cost math, exported for unit testing. Returns null when unpriced. */
export function estimateCostMicros(usage: { model: string; inputTokens: number; outputTokens: number }, pricing: Record<string, ModelPrice>): bigint | null {
  const price = pricing[usage.model];
  if (!price) return null;
  // BigInt math: (tokens * pricePerMTok) / 1_000_000, rounded down per side.
  const inCost = (BigInt(usage.inputTokens) * BigInt(Math.round(price.inPerMTokMicros))) / 1_000_000n;
  const outCost = (BigInt(usage.outputTokens) * BigInt(Math.round(price.outPerMTokMicros))) / 1_000_000n;
  return inCost + outCost;
}

/** Parse LLM_PRICING defensively; malformed config disables costing, never crashes. */
export function parsePricingEnv(raw: string | undefined): Record<string, ModelPrice> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    const out: Record<string, ModelPrice> = {};
    for (const [model, p] of Object.entries(parsed as Record<string, any>)) {
      if (p && typeof p.inPerMTokMicros === 'number' && typeof p.outPerMTokMicros === 'number' && p.inPerMTokMicros >= 0 && p.outPerMTokMicros >= 0) {
        out[model] = { inPerMTokMicros: p.inPerMTokMicros, outPerMTokMicros: p.outPerMTokMicros };
      }
    }
    return out;
  } catch {
    return {};
  }
}

@Injectable()
export class AiUsageService {
  private readonly logger = new Logger(AiUsageService.name);
  private readonly pricing = parsePricingEnv(process.env.LLM_PRICING);

  /** Last provider error observed (in-process readiness signal; never the key). */
  private lastProviderError: { at: string; kind: string } | null = null;

  constructor(private readonly prisma: PrismaService) {}

  /** True when a cost estimate is possible for at least one model. */
  get pricingConfigured(): boolean {
    return Object.keys(this.pricing).length > 0;
  }

  /**
   * Record one LLM call. Never throws — usage accounting must not break the
   * action it measures — but failures are logged, not swallowed invisibly.
   * Returns the recorded token/cost figures for task-level rollup.
   */
  async record(usage: LlmCallUsage): Promise<{ tokensIn: number; tokensOut: number; costMicros: bigint | null }> {
    const costMicros = estimateCostMicros(usage, this.pricing);
    try {
      await this.prisma.db.aiUsageEvent.create({
        data: {
          provider: usage.provider,
          model: usage.model,
          tokensIn: usage.inputTokens,
          tokensOut: usage.outputTokens,
          costMicros,
          agentKey: usage.agentKey ?? null,
          taskId: usage.taskId ?? null,
        } as any,
      });
    } catch (err) {
      this.logger.error(`usage record failed: ${(err as Error).message}`);
    }
    return { tokensIn: usage.inputTokens, tokensOut: usage.outputTokens, costMicros };
  }

  /** Additively roll tokens/cost up onto the owning AgentTask. */
  async addToTask(taskId: string, delta: { tokensIn: number; tokensOut: number; costMicros: bigint | null }): Promise<void> {
    try {
      await this.prisma.db.agentTask.update({
        where: { id: taskId },
        data: {
          tokensIn: { increment: delta.tokensIn },
          tokensOut: { increment: delta.tokensOut },
          ...(delta.costMicros !== null ? { costMicros: { increment: delta.costMicros } } : {}),
        },
      });
    } catch (err) {
      this.logger.error(`task usage rollup failed: ${(err as Error).message}`);
    }
  }

  /** Per-agent + per-model usage summary for a period (defaults: last 30 days). */
  async summary(opts: { since?: Date } = {}) {
    const since = opts.since ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const events = await this.prisma.db.aiUsageEvent.findMany({
      where: { createdAt: { gte: since } },
      select: { provider: true, model: true, agentKey: true, tokensIn: true, tokensOut: true, costMicros: true },
    });
    const byAgent: Record<string, { tokensIn: number; tokensOut: number; costMicros: string | null; calls: number; models: Record<string, { tokensIn: number; tokensOut: number; costMicros: string | null; calls: number }> }> = {};
    for (const e of events) {
      const agent = e.agentKey ?? 'unattributed';
      const a = (byAgent[agent] ??= { tokensIn: 0, tokensOut: 0, costMicros: null, calls: 0, models: {} });
      const m = (a.models[`${e.provider}/${e.model}`] ??= { tokensIn: 0, tokensOut: 0, costMicros: null, calls: 0 });
      for (const bucket of [a, m]) {
        bucket.tokensIn += e.tokensIn;
        bucket.tokensOut += e.tokensOut;
        bucket.calls += 1;
        if (e.costMicros !== null) bucket.costMicros = (BigInt(bucket.costMicros ?? '0') + e.costMicros).toString();
      }
    }
    return { since: since.toISOString(), pricingConfigured: this.pricingConfigured, costIsEstimate: true, byAgent };
  }

  // ── Provider readiness (honest states, never exposes keys/responses) ──────

  noteProviderError(kind: string): void {
    this.lastProviderError = { at: new Date().toISOString(), kind };
  }

  noteProviderSuccess(): void {
    this.lastProviderError = null;
  }

  /**
   * Honest readiness snapshot: configured/not_configured from env presence,
   * degraded when the most recent real call failed. Never pings the provider
   * on demand (that would burn quota on page loads) and never leaks details.
   */
  readiness(provider: { provider: string; model: string }) {
    if (provider.provider === 'stub') {
      return { state: 'not_configured' as const, provider: 'anthropic', model: provider.model, note: 'ANTHROPIC_API_KEY is not set — AI employees run in honest stub mode and cannot genuinely reason.' };
    }
    if (this.lastProviderError) {
      return { state: 'error' as const, provider: provider.provider, model: provider.model, lastError: this.lastProviderError };
    }
    return { state: 'configured' as const, provider: provider.provider, model: provider.model };
  }
}
