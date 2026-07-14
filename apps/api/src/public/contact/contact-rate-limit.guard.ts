import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import IORedis from 'ioredis';

/**
 * IP-based fixed-window rate limit for the public, unauthenticated Contact
 * form — the same technique as `ApiScopeGuard` (per-API-key rate limiting),
 * keyed by client IP instead of an API key since there's no tenant/key here.
 * Fails OPEN on a Redis outage so a cache blip never blocks a real inquiry.
 */
@Injectable()
export class ContactRateLimitGuard implements CanActivate {
  private static readonly LIMIT_PER_MINUTE = 5;
  private readonly redis = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
    maxRetriesPerRequest: 1,
    lazyConnect: true,
    enableOfflineQueue: false,
  });

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown';

    const key = `rl:contact:${ip}:${Math.floor(Date.now() / 60_000)}`;
    try {
      const count = await this.raceTimeout(this.redis.incr(key), 200);
      if (count === 1) this.redis.expire(key, 60).catch(() => undefined);
      if (count > ContactRateLimitGuard.LIMIT_PER_MINUTE) {
        throw new HttpException('Too many requests — please try again in a minute.', HttpStatus.TOO_MANY_REQUESTS);
      }
    } catch (err) {
      if (err instanceof HttpException) throw err;
      // Redis unreachable/timeout — fail open, matching ApiScopeGuard's policy.
    }
    return true;
  }

  private raceTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
    return Promise.race([p, new Promise<T>((_, reject) => setTimeout(() => reject(new Error('redis timeout')), ms))]);
  }
}
