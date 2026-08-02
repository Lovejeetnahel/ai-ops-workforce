import { Body, Controller, Get, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { IsArray, IsBoolean, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { IndustryModule, UserRole } from '@prisma/client';
import { listModules, listPresets } from '@aiow/config';
import { RolesGuard } from '../common/rbac/roles.guard';
import { Roles } from '../common/rbac/roles.decorator';
import { TenantsService } from './tenants.service';

class CreateTenantDto {
  @IsString() name: string;
  @IsString() firstName: string;
  @IsString() lastName: string;
  @IsString() ownerEmail: string;
  @IsString() @MinLength(8) ownerPassword: string;
  @IsEnum(IndustryModule) industryModule: IndustryModule;
  // Phase 1 onboarding fields — all optional so existing callers keep working.
  @IsOptional() @IsString() presetKey?: string;
  @IsOptional() @IsString() country?: string;
  @IsOptional() @IsString() businessSize?: string;
  @IsOptional() @IsString() teamSize?: string;
  // Website Release 2: required Terms/Privacy acceptance + optional, separate,
  // unchecked-by-default marketing consent.
  @IsBoolean() termsAccepted: boolean;
  @IsOptional() @IsBoolean() marketingConsent?: boolean;
}

class CreateStaffDto {
  @IsString() email: string;
  @IsString() @MinLength(6) password: string;
  @IsString() name: string;
  @IsEnum(UserRole) role: UserRole;
  @IsOptional() @IsArray() skills?: string[];
  @IsOptional() @IsArray() serviceZones?: string[];
}

class UpdateProfileDto {
  @IsString() @MinLength(1) timezone: string;
}

class UpdateOnboardingDto {
  @IsOptional() @IsArray() completedSteps?: string[];
  @IsOptional() @IsBoolean() skipped?: boolean;
  @IsOptional() @IsBoolean() dashboardReached?: boolean;
}

@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenants: TenantsService) {}

  /** Public onboarding: provision a business, its owner, and seed automations. */
  @Post()
  signup(@Body() dto: CreateTenantDto) {
    return this.tenants.provision(dto);
  }

  /** Industry modules available at signup (for the onboarding picker). */
  @Get('modules')
  modules() {
    return listModules().map((m) => ({ key: m.key, label: m.label, tagline: m.tagline }));
  }

  /** Industry presets (Phase 1): the full signup catalog with engine mapping. */
  @Get('presets')
  presets() {
    return listPresets().map((p) => ({
      key: p.key,
      engine: p.engine,
      label: p.label,
      tagline: p.tagline,
      icon: p.icon,
    }));
  }

  @Get('me')
  @UseGuards(RolesGuard)
  @Roles('STAFF')
  current() {
    return this.tenants.current();
  }

  /** Invite a staff/admin user (technician, dispatcher, manager). */
  @Post('users')
  @UseGuards(RolesGuard)
  @Roles('OWNER')
  createStaff(@Body() dto: CreateStaffDto) {
    return this.tenants.createStaffUser(dto);
  }

  /** Business profile updates (currently: timezone, IANA-validated). */
  @Patch('profile')
  @UseGuards(RolesGuard)
  @Roles('OWNER')
  updateProfile(@Body() dto: UpdateProfileDto) {
    return this.tenants.updateTimezone(dto.timezone);
  }

  /** First-time onboarding progress — stored additively in Tenant.settings. */
  @Patch('onboarding')
  @UseGuards(RolesGuard)
  @Roles('STAFF')
  updateOnboarding(@Body() dto: UpdateOnboardingDto) {
    return this.tenants.updateOnboarding(dto);
  }

  // ── Sprint 2 ─────────────────────────────────────────────────────────

  /** Team roster for Settings (no credentials ever returned). */
  @Get('team')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  team() {
    return this.tenants.listTeam();
  }

  /** Recent audit history (read-only) for Settings → Audit. */
  @Get('audit')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  audit(@Query('limit') limit?: string) {
    return this.tenants.auditHistory(limit ? parseInt(limit, 10) || 50 : 50);
  }

  /**
   * Honest integration status for Settings/Apps: configured-or-not per
   * provider, with the source (tenant vs platform). NEVER returns any secret.
   */
  @Get('integrations-status')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  integrationsStatus() {
    return this.tenants.integrationsStatus();
  }

  /** Change the industry preset — same engine only, OWNER only. */
  @Patch('preset')
  @UseGuards(RolesGuard)
  @Roles('OWNER')
  changePreset(@Body('presetKey') presetKey: string) {
    return this.tenants.changePreset(presetKey);
  }

  /** Apply preset-driven onboarding selections (goal, accepted KPIs, answers). */
  @Post('onboarding/apply')
  @UseGuards(RolesGuard)
  @Roles('OWNER')
  applyOnboarding(@Body() body: any) {
    return this.tenants.applyOnboarding({
      answers: body?.answers,
      mainGoal: body?.mainGoal,
      acceptKpis: Array.isArray(body?.acceptKpis) ? body.acceptKpis.slice(0, 12) : undefined,
      services: body?.services,
      locations: body?.locations,
    });
  }
}
