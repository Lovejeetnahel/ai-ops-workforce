import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { RolesGuard } from '../common/rbac/roles.guard';
import { Roles } from '../common/rbac/roles.decorator';
import { WebsitesService } from './websites.service';
import { EntitlementsService } from '../common/entitlements/entitlements.service';

/** Websites V1 — sites, pages, sections, revisions, publish, forms. */
@Controller('websites')
@UseGuards(RolesGuard)
export class WebsitesController {
  constructor(
    private readonly websites: WebsitesService,
    private readonly entitlements: EntitlementsService,
  ) {}

  @Get('sites')
  @Roles('STAFF')
  sites() {
    return this.websites.listSites();
  }

  @Post('sites')
  @Roles('ADMIN')
  async createSite(@Body('name') name: string) {
    await this.entitlements.require('sites');
    return this.websites.createSite(name);
  }

  @Get('pages/:id')
  @Roles('STAFF')
  page(@Param('id') id: string) {
    return this.websites.getPage(id);
  }

  @Post('pages')
  @Roles('STAFF')
  createPage(@Body() body: any) {
    return this.websites.createPage(body);
  }

  @Patch('pages/:id')
  @Roles('STAFF')
  updatePage(@Param('id') id: string, @Body() body: any) {
    return this.websites.updatePage(id, body);
  }

  @Post('pages/:id/publish')
  @Roles('ADMIN')
  publish(@Param('id') id: string) {
    return this.websites.setPublished(id, true);
  }

  @Post('pages/:id/unpublish')
  @Roles('ADMIN')
  unpublish(@Param('id') id: string) {
    return this.websites.setPublished(id, false);
  }

  @Post('pages/:id/restore/:revisionId')
  @Roles('STAFF')
  restore(@Param('id') id: string, @Param('revisionId') revisionId: string) {
    return this.websites.restoreRevision(id, revisionId);
  }

  @Post('ai-draft-section')
  @Roles('STAFF')
  aiDraft(@Body() body: { type: string; notes?: string }) {
    return this.websites.aiDraftSection(body);
  }

  @Get('submissions')
  @Roles('STAFF')
  submissions() {
    return this.websites.listSubmissions();
  }
}

/** Public site rendering + form submission — no auth. */
@Controller('public/sites')
export class PublicSitesController {
  constructor(private readonly websites: WebsitesService) {}

  @Get(':site/:page')
  page(@Param('site') site: string, @Param('page') page: string) {
    return this.websites.publicPage(site, page);
  }

  @Post(':site/:page/form')
  submit(@Param('site') site: string, @Param('page') page: string, @Body() body: any) {
    return this.websites.publicSubmit(site, page, body);
  }
}
