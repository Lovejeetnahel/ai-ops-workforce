import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { IsArray, IsOptional, IsString } from 'class-validator';
import { RolesGuard } from '../../common/rbac/roles.guard';
import { Roles } from '../../common/rbac/roles.decorator';
import { CompaniesService } from './companies.service';

class CreateCompanyDto {
  @IsString() name: string;
  @IsOptional() @IsString() domain?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() website?: string;
  @IsOptional() @IsArray() tags?: string[];
}

class UpdateCompanyDto extends CreateCompanyDto {
  @IsOptional() @IsString() declare name: string;
}

@Controller('companies')
@UseGuards(RolesGuard)
export class CompaniesController {
  constructor(private readonly companies: CompaniesService) {}

  @Post()
  @Roles('STAFF')
  create(@Body() dto: CreateCompanyDto) {
    return this.companies.create(dto);
  }

  @Get()
  @Roles('STAFF')
  list(@Query('q') q?: string) {
    return this.companies.list(q);
  }

  @Get(':id')
  @Roles('STAFF')
  get(@Param('id') id: string) {
    return this.companies.get(id);
  }

  @Patch(':id')
  @Roles('STAFF')
  update(@Param('id') id: string, @Body() dto: UpdateCompanyDto) {
    return this.companies.update(id, dto);
  }
}
