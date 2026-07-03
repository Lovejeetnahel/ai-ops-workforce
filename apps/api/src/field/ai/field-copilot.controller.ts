import { BadRequestException, Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { IsOptional, IsString } from 'class-validator';
import { RolesGuard } from '../../common/rbac/roles.guard';
import { Roles } from '../../common/rbac/roles.decorator';
import { tenantContext } from '../../common/tenancy/tenant-context';
import { FieldCopilotService } from './field-copilot.service';

class AskDto {
  @IsString() query: string;
  @IsOptional() @IsString() jobId?: string;
}

const parseDate = (s: string): Date => {
  const d = new Date(s);
  if (isNaN(d.getTime())) throw new BadRequestException(`Invalid date: ${s}`);
  return d;
};

@Controller('field/copilot')
@UseGuards(RolesGuard)
@Roles('STAFF')
export class FieldCopilotController {
  constructor(private readonly copilot: FieldCopilotService) {}
  private uid() {
    return tenantContext.get()!.userId!;
  }

  @Get('job/:jobId/summary')
  jobSummary(@Param('jobId') jobId: string) {
    return this.copilot.jobSummary(jobId);
  }
  @Get('job/:jobId/customer-history')
  customerHistory(@Param('jobId') jobId: string) {
    return this.copilot.customerHistory(jobId);
  }
  @Get('job/:jobId/recommendations')
  recommendations(@Param('jobId') jobId: string) {
    return this.copilot.recommendedActions(jobId);
  }
  @Get('job/:jobId/upsell')
  upsell(@Param('jobId') jobId: string) {
    return this.copilot.upsell(jobId);
  }
  @Get('daily-summary')
  daily(@Query('date') date?: string) {
    return this.copilot.dailySummary(this.uid(), date ? parseDate(date) : new Date());
  }
  @Get('shift-summary')
  shift(@Query('from') from: string, @Query('to') to: string) {
    return this.copilot.shiftSummary(this.uid(), parseDate(from), parseDate(to));
  }
  @Get('incident/:id/summary')
  incident(@Param('id') id: string) {
    return this.copilot.incidentSummary(id);
  }
  @Post('sop')
  sop(@Body() dto: AskDto) {
    return this.copilot.sopAssistant(dto.query, dto.jobId);
  }
  @Post('troubleshoot')
  troubleshoot(@Body() dto: AskDto) {
    return this.copilot.troubleshoot(dto.query, dto.jobId);
  }
  @Post('safety')
  safety(@Body() dto: AskDto) {
    return this.copilot.safetyAssistant(dto.query, dto.jobId);
  }
}
