import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe, Logger } from '@nestjs/common';
import helmet from 'helmet';
import * as express from 'express';
import { AppModule } from './app.module';
import { PrismaExceptionFilter } from './common/prisma/prisma-exception.filter';

/**
 * API entrypoint. Handles synchronous HTTP + inbound provider webhooks and is
 * the *producer* side of the automation engine. Slow work is enqueued to BullMQ
 * and executed by the worker process (worker.ts).
 */
/** Fail fast in production if critical configuration is missing or insecure. */
function validateEnv() {
  if (process.env.NODE_ENV !== 'production') return;
  const required = ['DATABASE_URL', 'REDIS_URL', 'JWT_SECRET', 'CREDENTIALS_ENCRYPTION_KEY', 'CORS_ORIGINS', 'ADMIN_API_TOKEN'];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) throw new Error(`Missing required env: ${missing.join(', ')}`);
  if ((process.env.JWT_SECRET ?? '').length < 32) throw new Error('JWT_SECRET must be at least 32 characters in production');
  if (!/^[0-9a-fA-F]{64}$/.test(process.env.CREDENTIALS_ENCRYPTION_KEY ?? '')) throw new Error('CREDENTIALS_ENCRYPTION_KEY must be 64 hex chars (32 bytes)');
  if ((process.env.ADMIN_API_TOKEN ?? '').length < 32) throw new Error('ADMIN_API_TOKEN must be at least 32 characters in production');
}

/**
 * Allowed cross-origin caller(s). NEVER reflect an arbitrary Origin while
 * credentials are enabled (a CORS misconfiguration that lets any site make
 * authenticated cross-origin requests) — require an explicit allowlist in
 * production (enforced by validateEnv), and default to localhost dev ports
 * otherwise so local development is unaffected.
 */
function corsOrigins(): string[] {
  const configured = process.env.CORS_ORIGINS;
  if (configured) return configured.split(',').map((o) => o.trim()).filter(Boolean);
  return ['http://localhost:3000', 'http://127.0.0.1:3000'];
}

async function bootstrap() {
  validateEnv();
  // bodyParser:false — we register our own express.json() below (with a
  // `verify` hook that captures the raw bytes) instead of relying on Nest's
  // default, otherwise both would try to consume the same request stream.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true, bodyParser: false });

  app.use(helmet());
  // Capture the exact raw request bytes alongside normal JSON parsing (does
  // not change parsing behavior for any route) so the Stripe webhook
  // controller can verify the HMAC signature against the bytes Stripe actually
  // signed — re-serializing the parsed object would not reliably match.
  app.use(express.json({ verify: (req: any, _res, buf) => { req.rawBody = buf; } }));
  app.use(express.urlencoded({ extended: true }));
  app.setGlobalPrefix('api');
  app.enableCors({ origin: corsOrigins(), credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  );
  app.useGlobalFilters(new PrismaExceptionFilter());
  app.enableShutdownHooks(); // lets Prisma + BullMQ drain on SIGTERM

  const port = Number(process.env.API_PORT ?? 4000);
  await app.listen(port);
  Logger.log(`API listening on :${port}`, 'Bootstrap');
}

bootstrap();
