import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { IsArray, IsOptional, IsString, MaxLength } from 'class-validator';
import { RolesGuard } from '../common/rbac/roles.guard';
import { Roles } from '../common/rbac/roles.decorator';
import { SocialService } from './social.service';

class CreatePostDto {
  @IsString() platform: string;
  @IsOptional() @IsString() @MaxLength(5000) caption?: string;
  @IsOptional() @IsArray() mediaRefs?: string[];
  @IsOptional() @IsString() scheduledFor?: string;
  @IsOptional() @IsString() campaignId?: string;
  @IsOptional() @IsString() goalId?: string;
  @IsOptional() @IsString() assignedToId?: string;
  @IsOptional() @IsString() agentKey?: string;
}

class UpdatePostDto {
  @IsOptional() @IsString() @MaxLength(5000) caption?: string;
  @IsOptional() @IsArray() mediaRefs?: string[];
  @IsOptional() scheduledFor?: string | null;
  @IsOptional() @IsString() platform?: string;
  @IsOptional() assignedToId?: string | null;
  @IsOptional() agentKey?: string | null;
  @IsOptional() campaignId?: string | null;
  @IsOptional() goalId?: string | null;
}

class ScheduleDto {
  @IsString() scheduledFor: string;
}

class PublishDto {
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

class AiDraftDto {
  @IsString() platform: string;
  @IsOptional() @IsString() @MaxLength(500) topic?: string;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
}

/** Social Media V1 — planning + approval; publishing is an honest manual step. */
@Controller('social')
@UseGuards(RolesGuard)
export class SocialController {
  constructor(private readonly social: SocialService) {}

  @Get('posts')
  @Roles('STAFF')
  list(
    @Query('status') status?: string,
    @Query('platform') platform?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.social.list({ status, platform, from, to });
  }

  @Get('connections')
  @Roles('STAFF')
  connections() {
    return this.social.connections();
  }

  @Get('export')
  @Roles('STAFF')
  exportContent(@Query('from') from?: string, @Query('to') to?: string) {
    return this.social.exportContent({ from, to });
  }

  @Get('posts/:id')
  @Roles('STAFF')
  get(@Param('id') id: string) {
    return this.social.get(id);
  }

  @Post('posts')
  @Roles('STAFF')
  create(@Body() dto: CreatePostDto) {
    return this.social.create(dto);
  }

  @Patch('posts/:id')
  @Roles('STAFF')
  update(@Param('id') id: string, @Body() dto: UpdatePostDto) {
    return this.social.update(id, dto);
  }

  @Post('posts/:id/submit')
  @Roles('STAFF')
  submit(@Param('id') id: string) {
    return this.social.submitForApproval(id);
  }

  @Post('posts/:id/approve')
  @Roles('ADMIN')
  approve(@Param('id') id: string) {
    return this.social.approve(id);
  }

  @Post('posts/:id/reject')
  @Roles('ADMIN')
  reject(@Param('id') id: string) {
    return this.social.reject(id);
  }

  @Post('posts/:id/schedule')
  @Roles('STAFF')
  schedule(@Param('id') id: string, @Body() dto: ScheduleDto) {
    return this.social.schedule(id, dto.scheduledFor);
  }

  @Post('posts/:id/mark-published')
  @Roles('STAFF')
  markPublished(@Param('id') id: string, @Body() dto: PublishDto) {
    return this.social.markPublished(id, dto.note);
  }

  @Post('posts/:id/cancel')
  @Roles('STAFF')
  cancel(@Param('id') id: string) {
    return this.social.cancel(id);
  }

  @Post('ai-draft')
  @Roles('STAFF')
  aiDraft(@Body() dto: AiDraftDto) {
    return this.social.aiDraft(dto);
  }
}
