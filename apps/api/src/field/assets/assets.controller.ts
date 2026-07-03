import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { AssetType } from '@prisma/client';
import { RolesGuard } from '../../common/rbac/roles.guard';
import { Roles } from '../../common/rbac/roles.decorator';
import { AssetsService } from './assets.service';

class AssetDto {
  @IsString() name: string;
  @IsOptional() @IsEnum(AssetType) type?: AssetType;
  @IsOptional() @IsString() identifier?: string;
}
class AssignDto {
  @IsOptional() @IsString() userId?: string;
}
class ItemDto {
  @IsString() name: string;
  @IsOptional() @IsString() sku?: string;
  @IsOptional() @IsString() unit?: string;
  @IsOptional() @IsNumber() quantity?: number;
  @IsOptional() @IsNumber() reorderLevel?: number;
}
class AdjustDto {
  @IsNumber() delta: number;
}
class MaterialDto {
  @IsString() description: string;
  @IsOptional() @IsNumber() quantity?: number;
  @IsOptional() @IsNumber() unitCost?: number;
  @IsOptional() @IsString() itemId?: string;
}

@Controller('field/assets')
@UseGuards(RolesGuard)
export class AssetsController {
  constructor(private readonly assets: AssetsService) {}

  @Post()
  @Roles('ADMIN')
  create(@Body() dto: AssetDto) {
    return this.assets.createAsset(dto);
  }
  @Get()
  @Roles('STAFF')
  list(@Query('status') status?: string) {
    return this.assets.listAssets(status);
  }
  @Post(':id/assign')
  @Roles('STAFF')
  assign(@Param('id') id: string, @Body() dto: AssignDto) {
    return this.assets.assignAsset(id, dto.userId ?? null);
  }
  @Get('scan/:identifier')
  @Roles('STAFF')
  scan(@Param('identifier') identifier: string) {
    return this.assets.scan(identifier);
  }

  @Post('inventory')
  @Roles('ADMIN')
  createItem(@Body() dto: ItemDto) {
    return this.assets.createItem(dto);
  }
  @Get('inventory')
  @Roles('STAFF')
  listItems() {
    return this.assets.listItems();
  }
  @Post('inventory/:id/adjust')
  @Roles('STAFF')
  adjust(@Param('id') id: string, @Body() dto: AdjustDto) {
    return this.assets.adjustItem(id, dto.delta);
  }

  @Post('materials/:jobId')
  @Roles('STAFF')
  recordMaterial(@Param('jobId') jobId: string, @Body() dto: MaterialDto) {
    return this.assets.recordMaterial(jobId, dto);
  }
  @Get('materials/:jobId')
  @Roles('STAFF')
  listMaterials(@Param('jobId') jobId: string) {
    return this.assets.listMaterials(jobId);
  }
}
