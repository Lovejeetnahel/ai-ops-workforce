import { BadRequestException, Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { IsNumber, IsOptional, IsString } from 'class-validator';
import { RolesGuard } from '../../common/rbac/roles.guard';
import { Roles } from '../../common/rbac/roles.decorator';
import { tenantContext } from '../../common/tenancy/tenant-context';
import { MovementService } from './movement.service';

class PingDto {
  @IsNumber() lat: number;
  @IsNumber() lng: number;
  @IsOptional() @IsString() jobId?: string;
}

const parseDate = (s: string): Date => {
  const d = new Date(s);
  if (isNaN(d.getTime())) throw new BadRequestException(`Invalid date: ${s}`);
  return d;
};

@Controller('field/movement')
@UseGuards(RolesGuard)
export class MovementController {
  constructor(private readonly movement: MovementService) {}
  private uid() {
    return tenantContext.get()!.userId!;
  }

  @Post('ping')
  @Roles('STAFF')
  ping(@Body() dto: PingDto) {
    return this.movement.ping(this.uid(), dto.lat, dto.lng, dto.jobId);
  }
  @Get('route')
  @Roles('STAFF')
  route(@Query('date') date?: string) {
    return this.movement.route(this.uid(), date ? parseDate(date) : new Date());
  }
  @Get('navigation/:jobId')
  @Roles('STAFF')
  navigation(@Param('jobId') jobId: string) {
    return this.movement.navigationLink(jobId);
  }
  @Get('team')
  @Roles('ADMIN')
  team() {
    return this.movement.teamLocations();
  }
  @Get('last/:userId')
  @Roles('ADMIN')
  last(@Param('userId') userId: string) {
    return this.movement.lastLocation(userId);
  }
}
