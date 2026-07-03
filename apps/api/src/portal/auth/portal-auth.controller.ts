import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { IsEmail, IsString, MinLength } from 'class-validator';
import { RolesGuard } from '../../common/rbac/roles.guard';
import { Roles } from '../../common/rbac/roles.decorator';
import { PortalAuthService } from './portal-auth.service';

class PortalLoginDto {
  @IsString() tenantSlug: string;
  @IsEmail() email: string;
  @IsString() @MinLength(6) password: string;
}

class CreatePortalUserDto {
  @IsString() contactId: string;
  @IsEmail() email: string;
  @IsString() @MinLength(6) password: string;
}

@Controller('portal/auth')
export class PortalAuthController {
  constructor(private readonly auth: PortalAuthService) {}

  /** Public customer login (tenant-branded). */
  @Post('login')
  login(@Body() dto: PortalLoginDto) {
    return this.auth.login(dto.tenantSlug, dto.email, dto.password);
  }

  /** Staff provisions portal access for a CRM contact. */
  @Post('users')
  @UseGuards(RolesGuard)
  @Roles('STAFF')
  create(@Body() dto: CreatePortalUserDto) {
    return this.auth.createForContact(dto.contactId, dto.email, dto.password);
  }
}
