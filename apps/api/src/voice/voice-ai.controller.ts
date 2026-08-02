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
    return this.voice.updateAgent(id, body);
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
