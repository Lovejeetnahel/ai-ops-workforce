import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { KnowledgeType, KnowledgeVisibility, MemoryKind, MemorySubject } from '@prisma/client';

const VALID_MEMORY_SUBJECTS = Object.values(MemorySubject);
import { RolesGuard } from '../common/rbac/roles.guard';
import { Roles } from '../common/rbac/roles.decorator';
import { tenantContext } from '../common/tenancy/tenant-context';
import { BusinessBrainService } from './business-brain.service';
import { BrainContextService } from './brain-context.service';

class IngestDto {
  @IsEnum(KnowledgeType) type: KnowledgeType;
  @IsString() title: string;
  @IsString() content: string;
  @IsOptional() @IsString() source?: string;
  @IsOptional() @IsEnum(KnowledgeVisibility) visibility?: KnowledgeVisibility;
}

class SearchDto {
  @IsString() query: string;
  @IsOptional() @IsInt() @Min(1) @Max(20) topK?: number;
}

class RecordMemoryDto {
  @IsEnum(MemorySubject) subjectType: MemorySubject;
  @IsString() subjectId: string;
  @IsEnum(MemoryKind) kind: MemoryKind;
  @IsString() content: string;
  @IsOptional() @IsString() key?: string;
}

/**
 * Business Brain REST surface. Knowledge writes are admin-gated; reads/search
 * are role-filtered (the service maps role → allowed visibility tiers, so a
 * CUSTOMER token only ever retrieves PUBLIC knowledge).
 */
@Controller('brain')
@UseGuards(RolesGuard)
export class BrainController {
  constructor(
    private readonly brain: BusinessBrainService,
    private readonly context: BrainContextService,
  ) {}

  private get role() {
    return tenantContext.get()?.role;
  }

  @Post('knowledge')
  @Roles('ADMIN')
  ingest(@Body() dto: IngestDto) {
    return this.brain.ingest(dto);
  }

  @Get('knowledge')
  @Roles('STAFF')
  list() {
    return this.brain.listKnowledge(this.role);
  }

  @Delete('knowledge/:id')
  @Roles('ADMIN')
  archive(@Param('id') id: string) {
    return this.brain.archiveKnowledge(id);
  }

  @Post('search')
  @Roles('STAFF')
  search(@Body() dto: SearchDto) {
    return this.brain.search(dto.query, { role: this.role, topK: dto.topK });
  }

  @Post('memory')
  @Roles('STAFF')
  remember(@Body() dto: RecordMemoryDto) {
    return this.brain.remember(dto);
  }

  @Get('memory/:subjectType/:subjectId')
  @Roles('STAFF')
  recall(@Param('subjectType') subjectType: string, @Param('subjectId') subjectId: string) {
    if (!VALID_MEMORY_SUBJECTS.includes(subjectType as MemorySubject))
      throw new BadRequestException(`Invalid subjectType: ${subjectType}. Valid values: ${VALID_MEMORY_SUBJECTS.join(', ')}`);
    return this.brain.recall(subjectType as MemorySubject, subjectId);
  }

  /** Debug: inspect the exact grounded context an agent would receive. */
  @Get('context')
  @Roles('ADMIN')
  preview(@Query('q') q: string) {
    return this.context.composeAgentContext({
      persona: 'You are an AI employee for this business.',
      query: q ?? 'overview',
      role: this.role,
    });
  }
}
