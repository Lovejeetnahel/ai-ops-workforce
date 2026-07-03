import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { IsArray, IsString } from 'class-validator';
import { RolesGuard } from '../../common/rbac/roles.guard';
import { Roles } from '../../common/rbac/roles.decorator';
import { TeamsService } from './teams.service';

class CreateTeamDto {
  @IsString() name: string;
}
class MembersDto {
  @IsArray() userIds: string[];
}

@Controller('teams')
@UseGuards(RolesGuard)
export class TeamsController {
  constructor(private readonly teams: TeamsService) {}

  @Post()
  @Roles('ADMIN')
  create(@Body() dto: CreateTeamDto) {
    return this.teams.create(dto.name);
  }

  @Get()
  @Roles('STAFF')
  list() {
    return this.teams.list();
  }

  @Patch(':id')
  @Roles('ADMIN')
  rename(@Param('id') id: string, @Body() dto: CreateTeamDto) {
    return this.teams.rename(id, dto.name);
  }

  @Post(':id/members')
  @Roles('ADMIN')
  setMembers(@Param('id') id: string, @Body() dto: MembersDto) {
    return this.teams.setMembers(id, dto.userIds);
  }
}
