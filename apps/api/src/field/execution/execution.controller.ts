import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { IsArray, IsEnum, IsObject, IsOptional, IsString } from 'class-validator';
import { ApprovalStatus, ApprovalType, AttachmentKind, FieldFormType, IndustryModule } from '@prisma/client';
import { RolesGuard } from '../../common/rbac/roles.guard';
import { Roles } from '../../common/rbac/roles.decorator';
import { tenantContext } from '../../common/tenancy/tenant-context';
import { ExecutionService } from './execution.service';

class AttachmentDto {
  @IsString() jobId: string;
  @IsEnum(AttachmentKind) kind: AttachmentKind;
  @IsString() url: string;
  @IsOptional() @IsString() mimeType?: string;
  @IsOptional() @IsObject() metadata?: Record<string, unknown>;
}
class TemplateDto {
  @IsString() key: string;
  @IsString() name: string;
  @IsEnum(FieldFormType) type: FieldFormType;
  @IsArray() schema: unknown[];
  @IsOptional() @IsEnum(IndustryModule) industryModule?: IndustryModule;
}
class SubmitFormDto {
  @IsOptional() @IsString() templateKey?: string;
  @IsOptional() @IsString() templateId?: string;
  @IsEnum(FieldFormType) type: FieldFormType;
  @IsOptional() @IsString() jobId?: string;
  @IsObject() answers: Record<string, unknown>;
}
class RequestApprovalDto {
  @IsString() jobId: string;
  @IsEnum(ApprovalType) type: ApprovalType;
}
class DecideApprovalDto {
  @IsEnum(ApprovalStatus) status: ApprovalStatus;
  @IsOptional() @IsString() notes?: string;
}

@Controller('field/execution')
@UseGuards(RolesGuard)
export class ExecutionController {
  constructor(private readonly execution: ExecutionService) {}
  private uid() {
    return tenantContext.get()!.userId!;
  }

  @Post('attachments')
  @Roles('STAFF')
  addAttachment(@Body() dto: AttachmentDto) {
    return this.execution.addAttachment(this.uid(), dto);
  }
  @Get('attachments/:jobId')
  @Roles('STAFF')
  listAttachments(@Param('jobId') jobId: string) {
    return this.execution.listAttachments(jobId);
  }

  @Post('templates')
  @Roles('ADMIN')
  createTemplate(@Body() dto: TemplateDto) {
    return this.execution.createTemplate(dto);
  }
  @Get('templates')
  @Roles('STAFF')
  listTemplates() {
    return this.execution.listTemplates();
  }

  @Post('forms')
  @Roles('STAFF')
  submitForm(@Body() dto: SubmitFormDto) {
    return this.execution.submitForm(this.uid(), dto);
  }
  @Get('forms')
  @Roles('STAFF')
  listForms(@Query('jobId') jobId?: string, @Query('type') type?: FieldFormType) {
    return this.execution.listForms({ jobId, type });
  }

  @Post('approvals')
  @Roles('STAFF')
  requestApproval(@Body() dto: RequestApprovalDto) {
    return this.execution.requestApproval(dto.jobId, dto.type, this.uid());
  }
  @Post('approvals/:id/decide')
  @Roles('ADMIN')
  decide(@Param('id') id: string, @Body() dto: DecideApprovalDto) {
    return this.execution.decideApproval(id, dto.status, this.uid(), dto.notes);
  }
  @Get('approvals')
  @Roles('STAFF')
  listApprovals(@Query('status') status?: ApprovalStatus) {
    return this.execution.listApprovals(status);
  }
}
