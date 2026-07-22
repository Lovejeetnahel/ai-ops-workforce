import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import IORedis from 'ioredis';
import { tenantContext } from '../common/tenancy/tenant-context';

/**
 * Per-TENANT fixed-window rate limit for Command Center runs — each run can
 * fan out into multiple LLM calls and tool executions, so this caps blast
 * radius and spend. Keyed by the authenticated tenant from server context
 * (never client input). Same technique + fail-open trade-off as the existing
 * login/contact/password-reset limiters.
 */
@Injectable()
export class CommandRateLimitGuard implements CanActivate {
  private static readonly LIMIT_PER_MINUTE = 10;
  private readonly redis = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
    maxRetriesPerRequest: 1,
    lazyConnect: true,
    enableOfflineQueue: false,
  });

  async canActivate(_ctx: ExecutionContext): Promise<boolean> {
    const tenantId = tenantContext.tenantIdOrNull;
    if (!tenantId) return true; // RolesGuard rejects unauthenticated calls anyway

    const key = `rl:command:${tenantId}:${Math.floor(Date.now() / 60_000)}`;
    try {
      const count = await this.raceTimeout(this.redis.incr(key), 200);
      if (count === 1) this.redis.expire(key, 60).catch(() => undefined);
      if (count > CommandRateLimitGuard.LIMIT_PER_MINUTE) {
        throw new HttpException('Too many Command Center runs — please wait a minute.', HttpStatus.TOO_MANY_REQUESTS);
      }
    } catch (err) {
      if (err instanceof HttpException) throw err;
      // Redis unreachable — fail open, matching the platform's other limiters.
    }
    return true;
  }

  private raceTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
    return Promise.race([p, new Promise<T>((_, reject) => setTimeout(() => reject(new Error('redis timeout')), ms))]);
  }
}
