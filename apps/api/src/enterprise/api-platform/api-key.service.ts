import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * Public API credentials. The raw key is shown ONCE on creation; only its
 * SHA-256 hash is stored. TenantMiddleware resolves an `x-api-key` header to a
 * tenant + scopes; this service manages the lifecycle.
 */
@Injectable()
export class ApiKeyService {
  constructor(private readonly prisma: PrismaService) {}

  static hash(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  async create(name: string, scopes: string[], rateLimitPerMin = 120) {
    const raw = `aiow_${randomBytes(4).toString('hex')}_${randomBytes(24).toString('hex')}`;
    const prefix = raw.slice(0, 14);
    const key = await this.prisma.db.apiKey.create({
      data: { name, prefix, hashedKey: ApiKeyService.hash(raw), scopes, rateLimitPerMin } as any,
    });
    return { id: key.id, name, prefix, scopes, rateLimitPerMin, apiKey: raw };
  }

  list() {
    return this.prisma.db.apiKey.findMany({
      select: { id: true, name: true, prefix: true, scopes: true, rateLimitPerMin: true, revoked: true, lastUsedAt: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  revoke(id: string) {
    return this.prisma.db.apiKey.update({ where: { id }, data: { revoked: true } });
  }
}
