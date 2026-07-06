import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { IsArray, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { IndustryModule, UserRole } from '@prisma/client';
import { listModules, listPresets } from '@aiow/config';
import { RolesGuard } from '../common/rbac/roles.guard';
import { Roles } from '../common/rbac/roles.decorator';
import { TenantsService } from './tenants.service';

class CreateTenantDto {
  @IsString() name: string;
  @IsString() ownerEmail: string;
  @IsString() ownerPassword: string;
  @IsEnum(IndustryModule) industryModule: IndustryModule;
  // Phase 1 onboarding fields — all optional so existing callers keep working.
  @IsOptional() @IsString() presetKey?: string;
  @IsOptional() @IsString() country?: string;
  @IsOptional() @IsString() businessSize?: string;
  @IsOptional() @IsString() teamSize?: string;
}

class CreateStaffDto {
  @IsString() email: string;
  @IsString() @MinLength(6) password: string;
  @IsString() name: string;
  @IsEnum(UserRole) role: UserRole;
  @IsOptional() @IsArray() skills?: string[];
  @IsOptional() @IsArray() serviceZones?: string[];
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
}
