import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { RolesGuard } from '../common/rbac/roles.guard';
import { Roles } from '../common/rbac/roles.decorator';
import { VoiceAiService } from './voice-ai.service';

/** Voice AI V1 — agents, honest phone status, real call logs and usage. */
@Controller('voice-ai')
@UseGuards(RolesGuard)
export class VoiceAiController {
  constructor(private readonly voice: VoiceAiService) {}

  @Get('agents')
  @Roles('STAFF')
  agents() {
    return this.voice.listAgents();
  }

  @Post('agents')
  @Roles('ADMIN')
  create(@Body() body: any) {
    return this.voice.createAgent(body);
  }

  @Patch('agents/:id')
  @Roles('ADMIN')
  update(@Param('id') id: string, @Body() body: any) {
    // Outbound authorization is an OWNER decision — strip it here so the
    // dedicated OWNER endpoint below is the only path that can grant it.
    const { outboundAuthorized: _stripped, ...rest } = body ?? {};
    return this.voice.updateAgent(id, rest);
  }

  /** Explicit owner authorization for outbound calling on one agent. */
  @Post('agents/:id/outbound-authorization')
  @Roles('OWNER')
  outboundAuthorization(@Param('id') id: string, @Body('authorized') authorized: boolean) {
    return this.voice.updateAgent(id, { outboundAuthorized: authorized === true });
  }

  /** Sprint 4: activation state machine (provider, numbers, steps). */
  @Get('setup')
  @Roles('ADMIN')
  setup() {
    return this.voice.setup();
  }

  /** Create a real sales opportunity from a call. */
  @Post('calls/:id/create-lead')
  @Roles('STAFF')
  createLead(@Param('id') id: string, @Body() body: { title?: string; estimatedValue?: number }) {
    return this.voice.createLeadFromCall(id, body ?? {});
  }

  /** Create a real appointment from a call (existing schedule engine). */
  @Post('calls/:id/create-booking')
  @Roles('STAFF')
  createBooking(@Param('id') id: string, @Body() body: { userId: string; start: string; durationMin?: number; notes?: string }) {
    return this.voice.createBookingFromCall(id, body);
  }

  @Get('calls')
  @Roles('STAFF')
  calls(@Query('status') status?: string, @Query('limit') limit?: string) {
    return this.voice.listCalls({ status, limit: limit ? parseInt(limit, 10) : undefined });
  }

  @Post('calls/:id/follow-up')
  @Roles('STAFF')
  followUp(@Param('id') id: string, @Body('title') title?: string) {
    return this.voice.callFollowUp(id, title);
  }

  @Patch('calls/:id')
  @Roles('STAFF')
  outcome(@Param('id') id: string, @Body() body: any) {
    return this.voice.setCallOutcome(id, body);
  }

  @Get('usage')
  @Roles('STAFF')
  usage(@Query('days') days?: string) {
    return this.voice.usage(days ? Math.max(1, Math.min(365, parseInt(days, 10) || 30)) : 30);
  }
}
