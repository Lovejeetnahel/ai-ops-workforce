import { Module } from '@nestjs/common';
import { ContactController } from './contact/contact.controller';
import { AdminContactController } from './contact/admin-contact.controller';
import { ContactService } from './contact/contact.service';
import { ContactRateLimitGuard } from './contact/contact-rate-limit.guard';
import { AdminTokenGuard } from './contact/admin-token.guard';

/**
 * Public, unauthenticated marketing-site endpoints (Contact form submission)
 * plus the platform-operator-only retrieval endpoints for that same data
 * (AdminContactController — gated by a shared secret, not tenant auth).
 */
@Module({
  controllers: [ContactController, AdminContactController],
  providers: [ContactService, ContactRateLimitGuard, AdminTokenGuard],
})
export class PublicModule {}
