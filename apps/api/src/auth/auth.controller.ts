import { Body, Controller, HttpException, HttpStatus, Post, Req } from '@nestjs/common';
import { IsEmail, IsString, MinLength } from 'class-validator';
import { Request } from 'express';
import IORedis from 'ioredis';
import { AuthService } from './auth.service';

class LoginDto {
  @IsEmail() email: string;
  @IsString() @MinLength(6) password: string;
}

/** Max login attempts per IP per minute before 429. Fail-open on Redis error. */
const LOGIN_RATE_LIMIT = 10;

@Controller('auth')
export class AuthController {
  private readonly redis = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
    maxRetriesPerRequest: 1,
    lazyConnect: true,
    enableOfflineQueue: false,
  });

  constructor(private readonly auth: AuthService) {}

  @Post('login')
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    const ip = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ?? req.ip ?? 'unknown';
    const key = `auth:login:${ip}:${Math.floor(Date.now() / 60_000)}`;
    try {
      const count = await Promise.race([
        this.redis.incr(key),
        new Promise<number>((_, r) => setTimeout(() => r(new Error('timeout')), 200)),
      ]);
      if (count === 1) this.redis.expire(key, 60).catch(() => undefined);
      if (count > LOGIN_RATE_LIMIT) throw new HttpException('Too many login attempts', HttpStatus.TOO_MANY_REQUESTS);
    } catch (e) {
      if (e instanceof HttpException) throw e;
      // Redis unavailable — fail open, do not block the request
    }
    return this.auth.login(dto.email, dto.password);
  }
}
