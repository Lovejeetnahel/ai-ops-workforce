import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { IsIn } from 'class-validator';
import { ContactSubmissionStatus } from '@prisma/client';
import { ContactService } from './contact.service';
import { AdminTokenGuard } from './admin-token.guard';

class UpdateSubmissionStatusDto {
  @IsIn(['NEW', 'READ', 'RESOLVED']) status: ContactSubmissionStatus;
}

/**
 * Platform-operator-only retrieval for Contact form submissions. Gated by
 * AdminTokenGuard (a shared secret, not a tenant/user session) — see that
 * guard's docstring for why: there is no cross-tenant admin concept in this
 * product today, and this data belongs to no tenant. Never reachable by any
 * tenant's JWT, and there is no public listing route.
 */
@Controller('admin/contact')
@UseGuards(AdminTokenGuard)
export class AdminContactController {
  constructor(private readonly contact: ContactService) {}

  @Get('submissions')
  list(@Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    return this.contact.list(page ? parseInt(page, 10) : undefined, pageSize ? parseInt(pageSize, 10) : undefined);
  }

  @Patch('submissions/:id')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateSubmissionStatusDto) {
    return this.contact.updateStatus(id, dto.status);
  }
}
