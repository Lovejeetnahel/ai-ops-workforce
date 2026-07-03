import { BadRequestException, Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { IsArray, IsNumber, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { DocumentStatus, DocumentType } from '@prisma/client';
import { RolesGuard } from '../common/rbac/roles.guard';
import { Roles } from '../common/rbac/roles.decorator';
import { DocumentsService } from './documents.service';

const VALID_DOC_TYPES = Object.values(DocumentType);
const VALID_DOC_STATUSES = Object.values(DocumentStatus);

class LineItemDto {
  @IsString() description: string;
  @IsOptional() @IsNumber() @Min(0) quantity?: number;
  @IsNumber() @Min(0) @Max(9_999_999_999) unitPrice: number;
}
class CreateDocDto {
  @IsOptional() @IsString() jobId?: string;
  @IsOptional() @IsString() leadId?: string;
  @IsOptional() @IsString() contactId?: string;
  @IsOptional() @IsString() title?: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => LineItemDto) lineItems: LineItemDto[];
}
class FromJobDto {
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => LineItemDto) lineItems?: LineItemDto[];
}

/** Quotes & invoices API — create, send, accept, convert, and read. */
@Controller('documents')
@UseGuards(RolesGuard)
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Post('quotes')
  @Roles('STAFF')
  createQuote(@Body() dto: CreateDocDto) {
    return this.documents.createQuote(dto);
  }

  @Post('invoices')
  @Roles('STAFF')
  createInvoice(@Body() dto: CreateDocDto) {
    return this.documents.createInvoice(dto);
  }

  @Post('invoices/from-job/:jobId')
  @Roles('STAFF')
  fromJob(@Param('jobId') jobId: string, @Body() dto: FromJobDto) {
    return this.documents.createInvoiceFromJob(jobId, dto.lineItems);
  }

  @Post('quotes/:id/accept')
  @Roles('STAFF')
  accept(@Param('id') id: string) {
    return this.documents.acceptQuote(id);
  }

  @Post('quotes/:id/convert')
  @Roles('STAFF')
  convert(@Param('id') id: string) {
    return this.documents.convertQuoteToInvoice(id);
  }

  @Post(':id/send')
  @Roles('STAFF')
  send(@Param('id') id: string) {
    return this.documents.send(id);
  }

  @Get()
  @Roles('STAFF')
  list(@Query('type') type?: string, @Query('status') status?: string) {
    if (type && !VALID_DOC_TYPES.includes(type as DocumentType))
      throw new BadRequestException(`Invalid type: ${type}`);
    if (status && !VALID_DOC_STATUSES.includes(status as DocumentStatus))
      throw new BadRequestException(`Invalid status: ${status}`);
    return this.documents.list({ type: type as DocumentType, status });
  }

  @Get(':id')
  @Roles('STAFF')
  get(@Param('id') id: string) {
    return this.documents.get(id);
  }
}
