import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { RolesGuard } from '../../common/rbac/roles.guard';
import { Roles } from '../../common/rbac/roles.decorator';
import { WebhookService } from './webhook.service';

@Controller('integrations')
@UseGuards(RolesGuard)
export class IntegrationsPlatformController {
  constructor(private readonly webhooks: WebhookService) {}

  @Get('catalog')
  @Roles('ADMIN')
  catalog() {
    return this.webhooks.catalog();
  }

  @Get('webhooks')
  @Roles('ADMIN')
  list() {
    return this.webhooks.list();
  }

  @Post('webhooks')
  @Roles('ADMIN')
  subscribe(@Body() body: { url: string; events: string[] }) {
    return this.webhooks.subscribe(body);
  }

  @Delete('webhooks/:id')
  @Roles('ADMIN')
  remove(@Param('id') id: string) {
    return this.webhooks.remove(id);
  }
}
