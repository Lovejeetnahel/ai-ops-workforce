import { Module, Global } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PasswordResetController } from './password-reset.controller';
import { PasswordResetRateLimitGuard } from './password-reset-rate-limit.guard';

/**
 * Global JwtModule registration so TenantMiddleware and guards can verify tokens
 * anywhere. Secret comes from JWT_SECRET.
 */
@Global()
@Module({
  imports: [
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET ?? 'dev-secret',
    }),
  ],
  controllers: [AuthController, PasswordResetController],
  providers: [AuthService, PasswordResetRateLimitGuard],
  exports: [JwtModule, AuthService],
})
export class AuthModule {}
