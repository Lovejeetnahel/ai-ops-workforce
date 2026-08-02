import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { RolesGuard } from '../common/rbac/roles.guard';
import { Roles } from '../common/rbac/roles.decorator';
import { ReviewsService } from './reviews.service';

class CreateRequestDto {
  @IsString() contactId: string;
  @IsOptional() @IsString() channel?: string;
  @IsOptional() @IsString() @MaxLength(1000) message?: string;
  @IsOptional() @IsString() jobId?: string;
}

class RecordReviewDto {
  @IsOptional() @IsString() contactId?: string;
  @IsOptional() @IsString() requestId?: string;
  @IsOptional() @IsString() source?: string;
  @IsInt() @Min(1) @Max(5) rating: number;
  @IsOptional() @IsString() @MaxLength(5000) text?: string;
  @IsOptional() @IsString() reviewedAt?: string;
}

class RespondDto {
  @IsString() @MaxLength(3000) responseText: string;
}

class FollowUpDto {
  @IsOptional() @IsString() @MaxLength(300) title?: string;
  @IsOptional() @IsString() dueAt?: string;
}

/** Reviews V1 — requests, recorded reviews, AI-drafted responses (approval-first). */
@Controller('reviews')
@UseGuards(RolesGuard)
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get('summary')
  @Roles('STAFF')
  summary() {
    return this.reviews.summary();
  }

  @Get('requests')
  @Roles('STAFF')
  listRequests() {
    return this.reviews.listRequests();
  }

  @Post('requests')
  @Roles('STAFF')
  createRequest(@Body() dto: CreateRequestDto) {
    return this.reviews.createRequest(dto);
  }

  @Get()
  @Roles('STAFF')
  list(
    @Query('responseStatus') responseStatus?: string,
    @Query('minRating') minRating?: string,
    @Query('maxRating') maxRating?: string,
  ) {
    return this.reviews.list({
      responseStatus,
      minRating: minRating ? Number(minRating) : undefined,
      maxRating: maxRating ? Number(maxRating) : undefined,
    });
  }

  @Post()
  @Roles('STAFF')
  record(@Body() dto: RecordReviewDto) {
    return this.reviews.record(dto);
  }

  @Post(':id/draft-response')
  @Roles('STAFF')
  draft(@Param('id') id: string) {
    return this.reviews.draftResponse(id);
  }

  @Post(':id/respond')
  @Roles('STAFF')
  respond(@Param('id') id: string, @Body() dto: RespondDto) {
    return this.reviews.respond(id, dto);
  }

  @Patch(':id/dismiss')
  @Roles('STAFF')
  dismiss(@Param('id') id: string) {
    return this.reviews.dismiss(id);
  }

  @Post(':id/follow-up')
  @Roles('STAFF')
  followUp(@Param('id') id: string, @Body() dto: FollowUpDto) {
    return this.reviews.createFollowUp(id, dto);
  }
}
