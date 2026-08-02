import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { RolesGuard } from '../common/rbac/roles.guard';
import { Roles } from '../common/rbac/roles.decorator';
import { AppointmentsService } from './appointments.service';

/** Appointments V1 — services, booking links, staff operations, stats. */
@Controller('appointments')
@UseGuards(RolesGuard)
export class AppointmentsController {
  constructor(private readonly appointments: AppointmentsService) {}

  @Get()
  @Roles('STAFF')
  list(@Query('from') from?: string, @Query('to') to?: string, @Query('status') status?: string) {
    return this.appointments.list({ from, to, status });
  }

  @Get('stats')
  @Roles('STAFF')
  stats() {
    return this.appointments.stats();
  }

  @Get('services')
  @Roles('STAFF')
  services() {
    return this.appointments.listServices();
  }

  @Post('services')
  @Roles('ADMIN')
  createService(@Body() body: any) {
    return this.appointments.createService(body);
  }

  @Patch('services/:id')
  @Roles('ADMIN')
  updateService(@Param('id') id: string, @Body() body: any) {
    return this.appointments.updateService(id, body);
  }

  @Get('links')
  @Roles('STAFF')
  links() {
    return this.appointments.listLinks();
  }

  @Post('links')
  @Roles('ADMIN')
  createLink(@Body() body: any) {
    return this.appointments.createLink(body);
  }

  @Patch('links/:id')
  @Roles('ADMIN')
  toggleLink(@Param('id') id: string, @Body('active') active: boolean) {
    return this.appointments.setLinkActive(id, !!active);
  }

  @Post(':id/reschedule')
  @Roles('STAFF')
  reschedule(@Param('id') id: string, @Body('start') start: string) {
    return this.appointments.reschedule(id, start);
  }

  @Patch(':id/status')
  @Roles('STAFF')
  setStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.appointments.setStatus(id, status);
  }

  @Patch(':id/notes')
  @Roles('STAFF')
  setNotes(@Param('id') id: string, @Body('notes') notes: string) {
    return this.appointments.setNotes(id, notes);
  }
}

/** Public self-booking endpoints — no auth; tenant comes from the link slug. */
@Controller('public/book')
export class PublicBookingController {
  constructor(private readonly appointments: AppointmentsService) {}

  @Get(':slug')
  link(@Param('slug') slug: string) {
    return this.appointments.publicLink(slug).then((l) => ({
      name: l.name,
      business: l.tenant.name,
      service: l.service ? { name: l.service.name, durationMin: l.service.durationMin, priceCents: l.service.priceCents } : null,
    }));
  }

  @Get(':slug/slots')
  slots(@Param('slug') slug: string, @Query('from') from?: string, @Query('days') days?: string) {
    return this.appointments.publicSlots(slug, from, days ? Math.max(1, Math.min(14, parseInt(days, 10) || 7)) : 7);
  }

  @Post(':slug')
  book(@Param('slug') slug: string, @Body() body: any) {
    return this.appointments.publicBook(slug, body);
  }
}
