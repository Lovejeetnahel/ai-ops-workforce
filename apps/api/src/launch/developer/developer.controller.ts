import { Controller, Get, UseGuards } from '@nestjs/common';
import { RolesGuard } from '../../common/rbac/roles.guard';
import { Roles } from '../../common/rbac/roles.decorator';
import { PrismaService } from '../../common/prisma/prisma.service';

const SCOPES = ['read:account', 'read:leads', 'read:jobs', 'read:invoices', '*'];

/**
 * Developer-portal backend: API usage, available scopes, and a generated OpenAPI
 * document for the public `/v1` surface (SDK/codegen target).
 */
@Controller('developer')
@UseGuards(RolesGuard)
export class DeveloperController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('scopes')
  @Roles('ADMIN')
  scopes() {
    return SCOPES;
  }

  @Get('usage')
  @Roles('ADMIN')
  usage() {
    return this.prisma.db.apiKey.findMany({ select: { id: true, name: true, prefix: true, scopes: true, lastUsedAt: true, revoked: true } });
  }

  @Get('openapi.json')
  @Roles('ADMIN')
  openapi() {
    const path = (summary: string, scope: string) => ({
      get: { summary, security: [{ ApiKeyAuth: [] }], 'x-required-scope': scope, responses: { '200': { description: 'OK' }, '401': { description: 'Unauthorized' }, '429': { description: 'Rate limited' } } },
    });
    return {
      openapi: '3.0.3',
      info: { title: 'AI Operations Workforce API', version: '1.0.0', description: 'Public REST API. Authenticate with an API key in the x-api-key header.' },
      servers: [{ url: '/api' }],
      components: { securitySchemes: { ApiKeyAuth: { type: 'apiKey', in: 'header', name: 'x-api-key' } } },
      paths: {
        '/v1/me': path('Current tenant', 'read:account'),
        '/v1/leads': path('List leads', 'read:leads'),
        '/v1/jobs': path('List jobs', 'read:jobs'),
        '/v1/invoices': path('List invoices', 'read:invoices'),
      },
    };
  }
}
