import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { IsOptional, IsString, MinLength } from 'class-validator';
import { PortalGuard, currentContactId } from './auth/portal.guard';
import { PortalService } from './portal.service';
import { BookingRequestService } from './booking-request.service';
import { NotificationsService } from './notifications.service';

class BookingRequestDto {
  @IsOptional() @IsString() serviceType?: string;
  @IsOptional() @IsString() urgency?: string;
  @IsOptional() @IsString() preferredAt?: string;
  @IsOptional() @IsString() notes?: string;
}
class MessageDto {
  @IsString() @MinLength(1) text: string;
}
class AssistantDto {
  @IsString() @MinLength(1) question: string;
}

/**
 * The customer-facing API. Every route is scoped to the authenticated customer
 * (PortalGuard + currentContactId) and reads/acts through existing systems.
 */
@Controller('portal')
@UseGuards(PortalGuard)
export class PortalController {
  constructor(
    private readonly portal: PortalService,
    private readonly bookingRequests: BookingRequestService,
    private readonly notifications: NotificationsService,
  ) {}

  @Get('dashboard')
  dashboard() {
    return this.portal.dashboard(currentContactId());
  }

  @Get('profile')
  profile() {
    return this.portal.profile(currentContactId());
  }

  @Get('jobs')
  jobs() {
    return this.portal.jobs(currentContactId());
  }

  @Get('jobs/:id')
  job(@Param('id') id: string) {
    return this.portal.jobDetail(currentContactId(), id);
  }

  @Get('jobs/:id/explain')
  explainJob(@Param('id') id: string) {
    return this.portal.explainJob(currentContactId(), id);
  }

  @Get('invoices')
  invoices() {
    return this.portal.invoices(currentContactId());
  }

  @Get('invoices/:id/explain')
  explainInvoice(@Param('id') id: string) {
    return this.portal.explainInvoice(currentContactId(), id);
  }

  @Get('documents')
  documents() {
    return this.portal.documents(currentContactId());
  }

  @Get('history')
  history() {
    return this.portal.history(currentContactId());
  }

  @Post('booking-request')
  requestBooking(@Body() dto: BookingRequestDto) {
    return this.bookingRequests.create(currentContactId(), dto);
  }

  @Get('booking-requests')
  listRequests() {
    return this.bookingRequests.list(currentContactId());
  }

  @Get('messages')
  messages() {
    return this.portal.messages(currentContactId());
  }

  @Post('messages')
  sendMessage(@Body() dto: MessageDto) {
    return this.portal.sendMessage(currentContactId(), dto.text);
  }

  @Post('assistant')
  assistant(@Body() dto: AssistantDto) {
    return this.portal.assistant(currentContactId(), dto.question);
  }

  @Get('notifications')
  listNotifications() {
    return this.notifications.list(currentContactId());
  }

  @Post('notifications/:id/read')
  readNotification(@Param('id') id: string) {
    return this.notifications.markRead(id, currentContactId());
  }

  @Post('notifications/read-all')
  readAll() {
    return this.notifications.markAllRead(currentContactId());
  }
}
