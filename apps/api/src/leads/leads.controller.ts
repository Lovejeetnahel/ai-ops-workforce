import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { IsOptional, IsString } from 'class-validator';
import { LeadStage } from '@prisma/client';
import { RolesGuard } from '../common/rbac/roles.guard';
import { Roles } from '../common/rbac/roles.decorator';
import { LeadsService } from './leads.service';

const VALID_LEAD_STAGES = Object.values(LeadStage);

class CreateLeadDto {
  @IsString() contactName: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() serviceType?: string;
  @IsOptional() @IsString() urgency?: string;
  @IsOptional() @IsString() location?: string;
}

/**
 * CRM REST surface. The pipeline board (owner dashboard) reads `board`; staff
 * read their assigned leads. All queries are tenant-scoped automatically by the
 * Prisma extension, so there is no `tenantId` in any handler.
 */
@Controller('leads')
@UseGuards(RolesGuard)
export class LeadsController {
  constructor(private readonly leads: LeadsService) {}

  @Get()
  @Roles('STAFF')
  list(@Query('stage') stage?: string) {
    if (stage && !VALID_LEAD_STAGES.includes(stage as LeadStage))
      throw new BadRequestException(`Invalid stage: ${stage}. Valid stages: ${VALID_LEAD_STAGES.join(', ')}`);
    return this.leads.list(stage);
  }

  /** Grouped by pipeline stage for the kanban board. */
  @Get('board')
  @Roles('STAFF')
  board() {
    return this.leads.board();
  }

  @Post()
  @Roles('STAFF')
  create(@Body() dto: CreateLeadDto) {
    return this.leads.createManual(dto);
  }

  @Patch(':id/stage')
  @Roles('STAFF')
  move(@Param('id') id: string, @Body('stage') stage: string) {
    if (!VALID_LEAD_STAGES.includes(stage as LeadStage))
      throw new BadRequestException(`Invalid stage: ${stage}. Valid stages: ${VALID_LEAD_STAGES.join(', ')}`);
    return this.leads.moveStage(id, stage);
  }
}
