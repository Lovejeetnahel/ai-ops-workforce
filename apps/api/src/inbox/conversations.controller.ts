import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { RolesGuard } from '../common/rbac/roles.guard';
import { Roles } from '../common/rbac/roles.decorator';
import { ConversationsService } from './conversations.service';

class CreateConversationDto {
  @IsOptional() @IsString() contactId?: string;
  @IsOptional() @IsString() @MaxLength(200) contactName?: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @IsOptional() @IsString() @MaxLength(200) email?: string;
  @IsString() channel: string;
  @IsOptional() @IsString() @MaxLength(200) subject?: string;
  @IsOptional() @IsString() @MaxLength(5000) body?: string;
}

class BodyDto {
  @IsString() @MaxLength(5000) body: string;
}

class AssignDto {
  @IsOptional() userId?: string | null;
  @IsOptional() agentKey?: string | null;
}

class StatusDto {
  @IsString() status: string;
}

class UnreadDto {
  @IsOptional() @IsBoolean() unread?: boolean;
}

/** Unified Inbox V1 — staff-facing conversation operations. */
@Controller('conversations')
@UseGuards(RolesGuard)
export class ConversationsController {
  constructor(private readonly conversations: ConversationsService) {}

  @Get()
  @Roles('STAFF')
  list(
    @Query('status') status?: string,
    @Query('channel') channel?: string,
    @Query('assigned') assigned?: string,
    @Query('unread') unread?: string,
    @Query('q') q?: string,
  ) {
    return this.conversations.list({ status, channel, assignedToId: assigned, unread: unread === 'true', q });
  }

  @Get('channels')
  @Roles('STAFF')
  channels() {
    return this.conversations.channels();
  }

  @Get(':id')
  @Roles('STAFF')
  get(@Param('id') id: string) {
    return this.conversations.get(id);
  }

  @Post()
  @Roles('STAFF')
  create(@Body() dto: CreateConversationDto) {
    return this.conversations.create(dto);
  }

  @Post(':id/reply')
  @Roles('STAFF')
  reply(@Param('id') id: string, @Body() dto: BodyDto) {
    return this.conversations.reply(id, dto);
  }

  @Post(':id/notes')
  @Roles('STAFF')
  note(@Param('id') id: string, @Body() dto: BodyDto) {
    return this.conversations.addNote(id, dto.body);
  }

  @Patch(':id/assign')
  @Roles('STAFF')
  assign(@Param('id') id: string, @Body() dto: AssignDto) {
    return this.conversations.assign(id, dto);
  }

  @Patch(':id/status')
  @Roles('STAFF')
  setStatus(@Param('id') id: string, @Body() dto: StatusDto) {
    return this.conversations.setStatus(id, dto.status);
  }

  @Post(':id/read')
  @Roles('STAFF')
  markRead(@Param('id') id: string) {
    return this.conversations.markRead(id);
  }

  /** AI draft — returned for human review, never auto-sent (approval-first). */
  @Post(':id/suggest-reply')
  @Roles('STAFF')
  suggest(@Param('id') id: string) {
    return this.conversations.suggestReply(id);
  }
}
