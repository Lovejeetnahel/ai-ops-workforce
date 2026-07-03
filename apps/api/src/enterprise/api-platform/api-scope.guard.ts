import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata, UnauthorizedException, HttpException, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import IORedis from 'ioredis';
import { tenantContext } from '../../common/tenancy/tenant-context';

export const SCOPES_KEY = 'api_scopes';
export const RequireScopes = (...scopes: string[]) => SetMetadata(SCOPES_KEY, scopes);

/**
 * Guards public-API (`/v1`) routes: requires an API-key session (scopes present
 * in context), enforces the required scopes, and applies a **Redis-backed**
 * fixed-window rate limit per API KEY (each key's own configured
 * `rateLimitPerMin`, defaulting to 120 if unset) — correct across
 * horizontally-scaled instances. Fails OPEN (allows the request) if Redis is
 * unreachable so a cache outage never takes the API down.
 *
 * Found via load testing: a key explicitly created with `rateLimitPerMin: 5`
 * still allowed 10/10 concurrent requests through — the limit was a hardcoded
 * static constant that never read the key's stored value, and the Redis
 * counter was keyed by tenant only, so every key for a tenant silently shared
 * one fixed 120/min budget regardless of its own configured limit.
 */
@Injectable()
export class ApiScopeGuard implements CanActivate {
  private static readonly DEFAULT_LIMIT = 120; // requests / minute, when a key has no configured limit
  private readonly redis = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
    maxRetriesPerRequest: 1,
    lazyConnect: true,
    enableOfflineQueue: false,
  });

  constructor(private readonly reflector: Reflector) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const store = tenantContext.get();
    if (!store?.scopes) throw new UnauthorizedException('API key authentication required');

    const required = this.reflector.getAllAndOverride<string[]>(SCOPES_KEY, [ctx.getHandler(), ctx.getClass()]) ?? [];
    const ok = required.every((s) => store.scopes!.includes(s) || store.scopes!.includes('*'));
    if (!ok) throw new ForbiddenException(`Missing scope(s): ${required.join(', ')}`);

    const limit = store.rateLimitPerMin ?? ApiScopeGuard.DEFAULT_LIMIT;
    if (!(await this.withinLimit(store.apiKeyId ?? store.tenantId, limit))) {
      throw new HttpException('Rate limit exceeded', HttpStatus.TOO_MANY_REQUESTS);
    }
    return true;
  }

  private async withinLimit(rateKeyId: string, limit: number): Promise<boolean> {
    const key = `rl:${rateKeyId}:${Math.floor(Date.now() / 60_000)}`;
    try {
      const count = await this.raceTimeout(this.redis.incr(key), 200);
      if (count === 1) this.redis.expire(key, 60).catch(() => undefined);
      return count <= limit;
    } catch {
      return true; // fail open on Redis error/timeout
    }
  }

  private raceTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
    return Promise.race([p, new Promise<T>((_, reject) => setTimeout(() => reject(new Error('redis timeout')), ms))]);
  }
}
