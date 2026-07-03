import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CryptoService } from '../common/crypto/crypto.service';
import { SmsPort, EmailPort, VoicePort, CalendarPort, PaymentPort, LlmPort } from './ports';
import { TwilioAdapter } from './adapters/twilio.adapter';
import { SendgridAdapter } from './adapters/sendgrid.adapter';
import { VapiAdapter } from './adapters/vapi.adapter';
import { GoogleCalendarAdapter } from './adapters/google-calendar.adapter';
import { StripeAdapter } from './adapters/stripe.adapter';
import { AnthropicAdapter } from './adapters/anthropic.adapter';
import { VoyageAdapter } from './adapters/voyage.adapter';
import { VisionAdapter } from './adapters/vision.adapter';
import { EmbeddingPort, VisionPort } from './ports';

/**
 * Builds the right adapter for a tenant. Credentials are read from the tenant's
 * Integration row (AES-decrypted); if absent, we fall back to platform-level env
 * credentials, and if those are absent too the adapters run in safe [stub] mode.
 * This is the only place that knows about concrete providers.
 */
@Injectable()
export class ProviderFactory {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
  ) {}

  private async creds(tenantId: string, provider: any): Promise<Record<string, any>> {
    const row = await this.prisma.integration.findUnique({
      where: { tenantId_provider: { tenantId, provider } },
    });
    if (row?.config) return this.crypto.decryptJson(row.config);
    return {};
  }

  async sms(tenantId: string): Promise<SmsPort> {
    const c = await this.creds(tenantId, 'TWILIO');
    return new TwilioAdapter({
      accountSid: c.accountSid ?? process.env.TWILIO_ACCOUNT_SID ?? '',
      authToken: c.authToken ?? process.env.TWILIO_AUTH_TOKEN ?? '',
      from: c.from ?? process.env.TWILIO_MESSAGING_SID ?? '',
      whatsappFrom: c.whatsappFrom,
    });
  }

  async email(tenantId: string): Promise<EmailPort> {
    const c = await this.creds(tenantId, 'SENDGRID');
    return new SendgridAdapter({
      apiKey: c.apiKey ?? process.env.SENDGRID_API_KEY ?? '',
      from: c.from ?? process.env.SENDGRID_FROM_EMAIL ?? 'no-reply@aiow.app',
    });
  }

  async voice(tenantId: string): Promise<VoicePort> {
    const c = await this.creds(tenantId, 'VAPI');
    return new VapiAdapter({
      apiKey: c.apiKey ?? process.env.VAPI_API_KEY ?? '',
      phoneNumberId: c.phoneNumberId ?? process.env.VAPI_PHONE_NUMBER_ID,
      assistantId: c.assistantId,
    });
  }

  async calendar(tenantId: string): Promise<CalendarPort> {
    const c = await this.creds(tenantId, 'GOOGLE_CALENDAR');
    return new GoogleCalendarAdapter({ accessToken: c.accessToken, calendarId: c.calendarId });
  }

  async payment(tenantId: string): Promise<PaymentPort> {
    const c = await this.creds(tenantId, 'STRIPE');
    return new StripeAdapter({
      secretKey: c.secretKey ?? process.env.STRIPE_SECRET_KEY ?? '',
      webhookSecret: c.webhookSecret ?? process.env.STRIPE_WEBHOOK_SECRET,
    });
  }

  /** LLM is platform-level (one Anthropic key), not per-tenant. */
  llm(): LlmPort {
    return new AnthropicAdapter(process.env.ANTHROPIC_API_KEY);
  }

  /** Embeddings are platform-level (Business Brain). Stub mode if unkeyed. */
  embeddings(): EmbeddingPort {
    return new VoyageAdapter(process.env.VOYAGE_API_KEY);
  }

  /** Vision/OCR for field media. Stub mode if unkeyed. */
  vision(): VisionPort {
    return new VisionAdapter(process.env.VISION_API_KEY);
  }
}
