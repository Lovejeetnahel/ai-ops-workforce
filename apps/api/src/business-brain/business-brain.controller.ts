import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { IsArray, IsEnum, IsNumber, IsObject, IsOptional, IsString, MaxLength, Max, Min } from 'class-validator';
import { GoalPriority, GoalStatus, KpiDirection } from '@prisma/client';
import { RolesGuard } from '../common/rbac/roles.guard';
import { Roles } from '../common/rbac/roles.decorator';
import { CompanyProfileService } from './company-profile.service';
import { GoalsService } from './goals.service';
import { KpisService } from './kpis.service';
import { ExecutiveService } from './executive.service';

class ProfilePatchDto {
  @IsOptional() @IsString() @MaxLength(200) legalName?: string;
  @IsOptional() @IsString() @MaxLength(200) brandName?: string;
  @IsOptional() @IsString() @MaxLength(300) tagline?: string;
  @IsOptional() @IsString() @MaxLength(2000) mission?: string;
  @IsOptional() @IsString() @MaxLength(2000) vision?: string;
  @IsOptional() @IsString() @MaxLength(2000) brandVoice?: string;
  @IsOptional() @IsString() @MaxLength(1000) targetMarket?: string;
  @IsOptional() @IsObject() workingHours?: Record<string, unknown>;
  @IsOptional() @IsArray() locations?: unknown[];
  @IsOptional() @IsArray() businessRules?: string[];
}

class GoalCreateDto {
  @IsString() @MaxLength(300) title: string;
  @IsOptional() @IsString() @MaxLength(4000) description?: string;
  @IsOptional() @IsEnum(GoalPriority) priority?: GoalPriority;
  @IsOptional() @IsEnum(GoalStatus) status?: GoalStatus;
  @IsOptional() @IsString() @MaxLength(100) department?: string;
  @IsOptional() @IsString() ownerUserId?: string;
  @IsOptional() @IsArray() agentKeys?: string[];
  @IsOptional() @IsString() parentGoalId?: string;
  @IsOptional() @IsString() startAt?: string;
  @IsOptional() @IsString() dueAt?: string;
}

class GoalPatchDto extends GoalCreateDto {
  @IsOptional() @IsString() @MaxLength(300) declare title: string;
}

class ProgressDto {
  @IsNumber() @Min(0) @Max(100) progress: number;
}

class KpiCreateDto {
  @IsString() @MaxLength(200) name: string;
  @IsOptional() @IsString() @MaxLength(30) unit?: string;
  @IsOptional() @IsEnum(KpiDirection) direction?: KpiDirection;
  @IsOptional() @IsString() @MaxLength(60) metricKey?: string;
  @IsOptional() @IsNumber() targetValue?: number;
  @IsOptional() @IsNumber() currentValue?: number;
  @IsOptional() @IsString() goalId?: string;
}

class KpiPatchDto extends KpiCreateDto {
  @IsOptional() @IsString() @MaxLength(200) declare name: string;
}

class KpiValueDto {
  @IsNumber() value: number;
}

/**
 * Business Brain REST surface (Sprint 1). Reads are STAFF+ (the whole team
 * works toward the same goals); writes are ADMIN+; the executive dashboard is
 * ADMIN+ because it aggregates business-wide financial signals. Free-text
 * company knowledge stays on the existing /brain endpoints.
 */
@Controller('business-brain')
@UseGuards(RolesGuard)
export class BusinessBrainController {
  constructor(
    private readonly profile: CompanyProfileService,
    private readonly goals: GoalsService,
    private readonly kpis: KpisService,
    private readonly executive: ExecutiveService,
  ) {}

  // ── Company profile ──────────────────────────────────────────────
  @Get('profile')
  @Roles('STAFF')
  getProfile() {
    return this.profile.get();
  }

  @Patch('profile')
  @Roles('ADMIN')
  patchProfile(@Body() dto: ProfilePatchDto) {
    return this.profile.update(dto);
  }

  // ── Goals ────────────────────────────────────────────────────────
  @Get('goals')
  @Roles('STAFF')
  listGoals(@Query('status') status?: GoalStatus, @Query('department') department?: string) {
    return this.goals.list({ status, department });
  }

  @Get('goals/:id')
  @Roles('STAFF')
  getGoal(@Param('id') id: string) {
    return this.goals.get(id);
  }

  @Post('goals')
  @Roles('ADMIN')
  createGoal(@Body() dto: GoalCreateDto) {
    return this.goals.create(dto);
  }

  @Patch('goals/:id')
  @Roles('ADMIN')
  patchGoal(@Param('id') id: string, @Body() dto: GoalPatchDto) {
    return this.goals.update(id, dto);
  }

  @Patch('goals/:id/progress')
  @Roles('ADMIN')
  setProgress(@Param('id') id: string, @Body() dto: ProgressDto) {
    return this.goals.setProgress(id, dto.progress);
  }

  @Delete('goals/:id')
  @Roles('ADMIN')
  archiveGoal(@Param('id') id: string) {
    // Archive, never destroy — history stays auditable.
    return this.goals.archive(id);
  }

  // ── KPIs ─────────────────────────────────────────────────────────
  @Get('kpis')
  @Roles('STAFF')
  listKpis() {
    return this.kpis.list();
  }

  @Post('kpis')
  @Roles('ADMIN')
  createKpi(@Body() dto: KpiCreateDto) {
    return this.kpis.create(dto);
  }

  @Patch('kpis/:id')
  @Roles('ADMIN')
  patchKpi(@Param('id') id: string, @Body() dto: KpiPatchDto) {
    return this.kpis.update(id, dto);
  }

  @Post('kpis/:id/value')
  @Roles('ADMIN')
  recordKpiValue(@Param('id') id: string, @Body() dto: KpiValueDto) {
    return this.kpis.recordValue(id, dto.value);
  }

  @Delete('kpis/:id')
  @Roles('ADMIN')
  removeKpi(@Param('id') id: string) {
    return this.kpis.remove(id);
  }

  // ── Executive dashboard ──────────────────────────────────────────
  @Get('executive')
  @Roles('ADMIN')
  executiveDashboard() {
    return this.executive.dashboard();
  }
}
