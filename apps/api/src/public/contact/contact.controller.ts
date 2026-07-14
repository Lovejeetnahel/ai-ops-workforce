import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import type { Request } from 'express';
import { ContactService } from './contact.service';
import { ContactRateLimitGuard } from './contact-rate-limit.guard';

class SubmitContactDto {
  @IsString() @MinLength(1) @MaxLength(200) name: string;
  @IsEmail() email: string;
  @IsOptional() @IsString() @MaxLength(200) company?: string;
  @IsOptional() @IsIn(['general', 'sales', 'support', 'security']) topic?: string;
  @IsString() @MinLength(1) @MaxLength(5000) message: string;
  /** Honeypot — real visitors never see or fill this field. */
  @IsOptional() @IsString() @MaxLength(200) website?: string;
}

/**
 * Public, unauthenticated Contact form endpoint for the marketing site.
 * Deliberately outside the tenant/auth system — a prospect has no tenant yet.
 * No @Roles/@UseGuards(RolesGuard): this route is meant to be reachable
 * without a bearer token, matching the existing public signup convention in
 * TenantsController.
 */
@Controller('public/contact')
export class ContactController {
  constructor(private readonly contact: ContactService) {}

  @Post()
  @UseGuards(ContactRateLimitGuard)
  async submit(@Body() dto: SubmitContactDto, @Req() req: Request) {
    // Honeypot tripped — pretend success, write nothing.
    if (dto.website && dto.website.trim().length > 0) {
      return { ok: true };
    }
    return this.contact.submit({
      name: dto.name,
      email: dto.email,
      company: dto.company,
      topic: dto.topic,
      message: dto.message,
      ip: req.ip,
    });
  }
}
