import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { RolesGuard } from '../../common/rbac/roles.guard';
import { Roles } from '../../common/rbac/roles.decorator';
import { OrganizationService } from './organization.service';

@Controller('organizations')
@UseGuards(RolesGuard)
export class OrganizationsController {
  constructor(private readonly organizations: OrganizationService) {}

  @Post()
  @Roles('OWNER')
  create(@Body() body: { name: string; type?: string }) {
    return this.organizations.create(body.name, body.type);
  }

  @Post('join')
  @Roles('OWNER')
  join(@Body() body: { slug: string }) {
    return this.organizations.join(body.slug);
  }

  @Get('rollup')
  @Roles('ADMIN')
  rollup(@Query('days') days?: string) {
    return this.organizations.rollup(days ? Math.max(1, Math.min(365, parseInt(days, 10) || 30)) : 30);
  }
}
