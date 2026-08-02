import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { RolesGuard } from '../common/rbac/roles.guard';
import { Roles } from '../common/rbac/roles.decorator';
import { WorkspaceService } from './workspace.service';
import { StaffNotificationsService } from './staff-notifications.service';

/** Sprint 3: staff notifications center. */
@Controller('notifications')
@UseGuards(RolesGuard)
export class StaffNotificationsController {
  constructor(private readonly notifications: StaffNotificationsService) {}

  @Get()
  @Roles('STAFF')
  list(@Query('unread') unread?: string, @Query('category') category?: string, @Query('limit') limit?: string) {
    return this.notifications.list({ unread: unread === 'true', category, limit: limit ? parseInt(limit, 10) : undefined });
  }

  @Get('unread-count')
  @Roles('STAFF')
  unread() {
    return this.notifications.unreadCount();
  }

  @Post(':id/read')
  @Roles('STAFF')
  read(@Param('id') id: string) {
    return this.notifications.markRead(id);
  }

  @Post('read-all')
  @Roles('STAFF')
  readAll() {
    return this.notifications.markAllRead();
  }
}

/** Sprint 3: multi-location operations. */
@Controller('locations')
@UseGuards(RolesGuard)
export class LocationsController {
  constructor(private readonly workspace: WorkspaceService) {}

  @Get()
  @Roles('STAFF')
  list() {
    return this.workspace.listLocations();
  }

  @Post()
  @Roles('OWNER')
  create(@Body() body: any) {
    return this.workspace.createLocation(body);
  }

  @Patch(':id')
  @Roles('OWNER')
  update(@Param('id') id: string, @Body() body: any) {
    return this.workspace.updateLocation(id, body);
  }

  @Patch('users/:userId')
  @Roles('ADMIN')
  assignUser(@Param('userId') userId: string, @Body('locationId') locationId: string | null) {
    return this.workspace.assignUserLocation(userId, locationId || null);
  }

  @Get('executive')
  @Roles('ADMIN')
  executive(@Query('days') days?: string) {
    return this.workspace.byLocation(days ? Math.max(1, Math.min(365, parseInt(days, 10) || 30)) : 30);
  }
}

/** Sprint 3: global search (tenant-scoped, RBAC-guarded). */
@Controller('search')
@UseGuards(RolesGuard)
export class SearchController {
  constructor(private readonly workspace: WorkspaceService) {}

  @Get()
  @Roles('STAFF')
  search(@Query('q') q: string) {
    return this.workspace.search(q ?? '');
  }
}
