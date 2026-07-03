import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { RolesGuard } from '../../common/rbac/roles.guard';
import { Roles } from '../../common/rbac/roles.decorator';
import { MarketplaceService } from './marketplace.service';

@Controller('marketplace')
@UseGuards(RolesGuard)
export class MarketplaceController {
  constructor(private readonly marketplace: MarketplaceService) {}

  @Get()
  @Roles('STAFF')
  catalog(@Query('type') type?: string, @Query('q') q?: string) {
    return this.marketplace.catalog({ type, q });
  }

  @Get('installs')
  @Roles('ADMIN')
  installs() {
    return this.marketplace.installs();
  }

  @Get(':id')
  @Roles('STAFF')
  get(@Param('id') id: string) {
    return this.marketplace.get(id);
  }

  @Post('publish')
  @Roles('OWNER')
  publish(@Body() body: any) {
    return this.marketplace.publish(body);
  }

  @Post(':id/install')
  @Roles('ADMIN')
  install(@Param('id') id: string) {
    return this.marketplace.install(id);
  }

  @Post(':id/review')
  @Roles('STAFF')
  review(@Param('id') id: string, @Body() body: { rating: number; comment?: string }) {
    return this.marketplace.review(id, body.rating, body.comment);
  }
}
