import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { IsArray, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { IndustryModule, UserRole } from '@prisma/client';
import { listModules } from '@aiow/config';
import { RolesGuard } from '../common/rbac/roles.guard';
import { Roles } from '../common/rbac/roles.decorator';
import { TenantsService } from './tenants.service';

class CreateTenantDto {
  @IsString() name: string;
  @IsString() ownerEmail: string;
  @IsString() ownerPassword: string;
  @IsEnum(IndustryModule) industryModule: IndustryModule;
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
