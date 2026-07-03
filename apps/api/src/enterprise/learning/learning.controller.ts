import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { RolesGuard } from '../../common/rbac/roles.guard';
import { Roles } from '../../common/rbac/roles.decorator';
import { LearningService } from './learning.service';

class FeedbackDto {
  @IsString() subjectType: string;
  @IsOptional() @IsString() subjectId?: string;
  @IsOptional() @IsString() agentKey?: string;
  @IsOptional() @IsString() decisionId?: string;
  @IsOptional() @IsNumber() @Min(0) @Max(5) rating?: number;
  @IsOptional() @IsString() sentiment?: string;
  @IsOptional() @IsString() comment?: string;
}

@Controller('learning')
@UseGuards(RolesGuard)
export class LearningController {
  constructor(private readonly learning: LearningService) {}

  @Post('feedback')
  @Roles('STAFF')
  feedback(@Body() body: FeedbackDto) {
    return this.learning.recordFeedback(body);
  }

  @Get('decision-scoring')
  @Roles('ADMIN')
  scoring() {
    return this.learning.decisionScoring();
  }

  @Get('agent-value')
  @Roles('ADMIN')
  agentValue() {
    return this.learning.agentValue();
  }

  @Get('recommendations')
  @Roles('ADMIN')
  recommendations() {
    return this.learning.recommendations();
  }
}
