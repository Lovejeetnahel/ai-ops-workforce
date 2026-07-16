import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { IsEmail, IsString, Matches, MinLength } from 'class-validator';
import { ProviderFactory } from '../integrations/provider-factory.service';
import { AuthService } from './auth.service';
import { PasswordResetRateLimitGuard } from './password-reset-rate-limit.guard';

class ForgotPasswordDto {
  @IsEmail() email: string;
}

class ResetPasswordDto {
  @IsString() @MinLength(1) token: string;
  @IsString() @MinLength(8) @Matches(/(?=.*[A-Za-z])(?=.*\d)/, { message: 'Password must contain at least one letter and one number' })
  password: string;
}

const PUBLIC_APP_URL = process.env.PUBLIC_APP_URL ?? 'http://localhost:3000';

/**
 * Public, unauthenticated password-recovery endpoints. Deliberately separate
 * from AuthController's login/refresh/logout — same public-route convention
 * as the rest of `/auth/*`.
 */
@Controller('auth')
export class PasswordResetController {
  constructor(
    private readonly auth: AuthService,
    private readonly providers: ProviderFactory,
  ) {}

  /**
   * Always returns the same generic acknowledgement whether or not the email
   * is registered — the response must never be used by the frontend to
   * branch on account existence.
   */
  @Post('forgot-password')
  @UseGuards(PasswordResetRateLimitGuard)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.auth.requestPasswordReset(dto.email, async (_userId, tenantId, name, rawToken) => {
      const email = await this.providers.email(tenantId);
      const link = `${PUBLIC_APP_URL}/reset-password?token=${encodeURIComponent(rawToken)}`;
      await email.send({
        to: dto.email,
        subject: 'Reset your Sofilic password',
        html: `<p>Hi ${name},</p><p>Use the link below to reset your Sofilic password. This link expires in 1 hour and can only be used once.</p><p><a href="${link}">${link}</a></p><p>If you didn't request this, you can safely ignore this email.</p>`,
      });
    });
    return { ok: true, message: 'If an eligible account exists and email delivery is available, reset instructions will be sent.' };
  }

  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto.token, dto.password);
  }
}
