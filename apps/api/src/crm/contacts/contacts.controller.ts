import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { IsArray, IsOptional, IsString, MaxLength } from 'class-validator';
import { RolesGuard } from '../../common/rbac/roles.guard';
import { Roles } from '../../common/rbac/roles.decorator';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EntitlementsService } from '../../common/entitlements/entitlements.service';

class CreateContactDto {
  @IsString() @MaxLength(200) name: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @IsOptional() @IsString() @MaxLength(200) email?: string;
  @IsOptional() @IsString() companyId?: string;
  @IsOptional() @IsArray() tags?: string[];
}

class UpdateContactDto {
  @IsOptional() @IsString() @MaxLength(200) name?: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @IsOptional() @IsString() @MaxLength(200) email?: string;
  @IsOptional() companyId?: string | null;
  @IsOptional() @IsArray() tags?: string[];
}

/**
 * Sprint 2: first-class Contacts API (the CRM page previously derived contacts
 * from the leads board). Read/write over the EXISTING Contact model only.
 */
@Controller('contacts')
@UseGuards(RolesGuard)
export class ContactsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlements: EntitlementsService,
  ) {}

  @Get()
  @Roles('STAFF')
  list(@Query('q') q?: string, @Query('tag') tag?: string) {
    const where: any = {};
    if (q)
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q } },
      ];
    if (tag) where.tags = { has: tag };
    return this.prisma.db.contact.findMany({
      where,
      include: {
        company: { select: { id: true, name: true } },
        _count: { select: { leads: true, conversations: true, payments: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 200,
    });
  }

  @Get(':id')
  @Roles('STAFF')
  async detail(@Param('id') id: string) {
    const contact = await this.prisma.db.contact.findFirst({
      where: { id },
      include: {
        company: { select: { id: true, name: true } },
        leads: { orderBy: { createdAt: 'desc' }, take: 20 },
        conversations: { select: { id: true, channel: true, status: true, lastMessageAt: true }, orderBy: { updatedAt: 'desc' }, take: 20 },
        activities: { orderBy: { createdAt: 'desc' }, take: 50 },
        documents: { select: { id: true, type: true, status: true, title: true, amount: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 20 },
        payments: { select: { id: true, amount: true, status: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 20 },
        reviews: { select: { id: true, rating: true, source: true, reviewedAt: true }, orderBy: { reviewedAt: 'desc' }, take: 10 },
      },
    });
    if (!contact) throw new BadRequestException('Contact not found');
    return contact;
  }

  @Post()
  @Roles('STAFF')
  async create(@Body() dto: CreateContactDto) {
    // Plan limit applies to manual creation only — inbound leads (website
    // forms, portal, calls) are the customer's own data and are never blocked.
    await this.entitlements.require('contacts');
    return this.prisma.db.contact.create({
      data: {
        name: dto.name.trim(),
        phone: dto.phone ?? null,
        email: dto.email ?? null,
        companyId: dto.companyId ?? null,
        tags: dto.tags ?? [],
      } as any,
    });
  }

  @Patch(':id')
  @Roles('STAFF')
  async update(@Param('id') id: string, @Body() dto: UpdateContactDto) {
    const existing = await this.prisma.db.contact.findFirst({ where: { id }, select: { id: true, tenantId: true } });
    if (!existing) throw new BadRequestException('Contact not found');
    const data: any = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.phone !== undefined) data.phone = dto.phone;
    if (dto.email !== undefined) data.email = dto.email;
    if (dto.companyId !== undefined) data.companyId = dto.companyId;
    if (dto.tags !== undefined) data.tags = dto.tags;
    return this.prisma.db.contact.update({ where: { id }, data });
  }
}
