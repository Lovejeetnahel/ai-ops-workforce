import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { RolesGuard } from '../common/rbac/roles.guard';
import { Roles } from '../common/rbac/roles.decorator';
import { AudienceFilter, CampaignsService } from './campaigns.service';

class CreateCampaignDto {
  @IsString() @MaxLength(200) name: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsString() channel: string;
  @IsOptional() @IsString() @MaxLength(300) subject?: string;
  @IsOptional() @IsString() @MaxLength(10000) content?: string;
  @IsOptional() audience?: AudienceFilter;
  @IsOptional() @IsString() goalId?: string;
  @IsOptional() @IsBoolean() isTemplate?: boolean;
  @IsOptional() @IsString() scheduledAt?: string;
}

class UpdateCampaignDto {
  @IsOptional() @IsString() @MaxLength(200) name?: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsString() @MaxLength(300) subject?: string;
  @IsOptional() @IsString() @MaxLength(10000) content?: string;
  @IsOptional() audience?: AudienceFilter;
  @IsOptional() goalId?: string | null;
  @IsOptional() scheduledAt?: string | null;
}

class PreviewDto {
  @IsOptional() audience?: AudienceFilter;
  @IsString() channel: string;
}

class AiDraftDto {
  @IsString() channel: string;
  @IsOptional() @IsString() @MaxLength(500) goal?: string;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
}

/**
 * Marketing V1. Reads/drafts are STAFF; approval is ADMIN; starting a send is
 * ADMIN (external, financially meaningful action — approval-first).
 */
@Controller('marketing')
@UseGuards(RolesGuard)
export class MarketingController {
  constructor(private readonly campaigns: CampaignsService) {}

  @Get('campaigns')
  @Roles('STAFF')
  list(@Query('status') status?: string, @Query('templates') templates?: string) {
    return this.campaigns.list({ status, templates: templates === 'true' });
  }

  @Get('campaigns/:id')
  @Roles('STAFF')
  get(@Param('id') id: string) {
    return this.campaigns.get(id);
  }

  @Get('campaigns/:id/metrics')
  @Roles('STAFF')
  metrics(@Param('id') id: string) {
    return this.campaigns.metrics(id);
  }

  @Post('campaigns')
  @Roles('STAFF')
  create(@Body() dto: CreateCampaignDto) {
    return this.campaigns.create(dto);
  }

  @Patch('campaigns/:id')
  @Roles('STAFF')
  update(@Param('id') id: string, @Body() dto: UpdateCampaignDto) {
    return this.campaigns.update(id, dto);
  }

  @Post('campaigns/:id/approve')
  @Roles('ADMIN')
  approve(@Param('id') id: string) {
    return this.campaigns.approve(id);
  }

  @Post('campaigns/:id/start')
  @Roles('ADMIN')
  start(@Param('id') id: string) {
    return this.campaigns.start(id);
  }

  @Post('campaigns/:id/pause')
  @Roles('ADMIN')
  pause(@Param('id') id: string) {
    return this.campaigns.setStatus(id, 'PAUSED');
  }

  @Post('campaigns/:id/cancel')
  @Roles('ADMIN')
  cancel(@Param('id') id: string) {
    return this.campaigns.setStatus(id, 'CANCELLED');
  }

  @Post('audience/preview')
  @Roles('STAFF')
  preview(@Body() dto: PreviewDto) {
    return this.campaigns.previewAudience(dto.audience ?? {}, dto.channel);
  }

  @Post('ai-draft')
  @Roles('STAFF')
  aiDraft(@Body() dto: AiDraftDto) {
    return this.campaigns.aiDraft(dto);
  }
}
