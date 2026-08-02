import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { RolesGuard } from '../common/rbac/roles.guard';
import { Roles } from '../common/rbac/roles.decorator';
import { SeoService } from './seo.service';

/** SEO V1 — deterministic audits over real pages; external data setup-required. */
@Controller('seo')
@UseGuards(RolesGuard)
export class SeoController {
  constructor(private readonly seo: SeoService) {}

  @Post('audit')
  @Roles('STAFF')
  audit() {
    return this.seo.runAudit();
  }

  @Get('history')
  @Roles('STAFF')
  history() {
    return this.seo.history();
  }

  @Post('tasks')
  @Roles('STAFF')
  task(@Body() body: any) {
    return this.seo.createTask(body);
  }

  @Post('ai-recommendations')
  @Roles('STAFF')
  ai() {
    return this.seo.aiRecommendations();
  }
}
