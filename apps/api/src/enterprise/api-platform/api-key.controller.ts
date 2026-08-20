import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { IsArray, IsOptional, IsNumber, IsString } from 'class-validator';
import { RolesGuard } from '../../common/rbac/roles.guard';
import { Roles } from '../../common/rbac/roles.decorator';
import { ApiKeyService } from './api-key.service';
import { EntitlementsService } from '../../common/entitlements/entitlements.service';

class CreateKeyDto {
  @IsString() name: string;
  @IsArray() scopes: string[];
  @IsOptional() @IsNumber() rateLimitPerMin?: number;
}

@Controller('api-keys')
@UseGuards(RolesGuard)
export class ApiKeyController {
  constructor(
    private readonly keys: ApiKeyService,
    private readonly entitlements: EntitlementsService,
  ) {}

  @Post()
  @Roles('OWNER')
  async create(@Body() dto: CreateKeyDto) {
    await this.entitlements.require('apiKeys');
    return this.keys.create(dto.name, dto.scopes, dto.rateLimitPerMin);
  }

  @Get()
  @Roles('ADMIN')
  list() {
    return this.keys.list();
  }

  @Delete(':id')
  @Roles('OWNER')
  revoke(@Param('id') id: string) {
    return this.keys.revoke(id);
  }
}
