import { Module } from '@nestjs/common';
import { ContactController } from './contact/contact.controller';
import { ContactService } from './contact/contact.service';
import { ContactRateLimitGuard } from './contact/contact-rate-limit.guard';

/** Public, unauthenticated marketing-site endpoints (currently: Contact form). */
@Module({
  controllers: [ContactController],
  providers: [ContactService, ContactRateLimitGuard],
})
export class PublicModule {}
