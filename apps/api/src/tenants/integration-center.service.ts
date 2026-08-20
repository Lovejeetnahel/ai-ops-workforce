import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CryptoService } from '../common/crypto/crypto.service';
import { ProviderFactory } from '../integrations/provider-factory.service';
import { tenantContext } from '../common/tenancy/tenant-context';

/**
 * Sprint 4 integration center. One honest management surface per provider:
 * connection status (tenant credentials, platform fallback, or none), health
 * derived from real activity + stored provider errors, connect/disconnect
 * with encrypted-at-rest config, and a genuine credential probe against the
 * provider's own API. Secrets are never returned, logged, or displayed —
 * only field NAMES and boolean presence.
 */

interface CatalogEntry {
  key: 'TWILIO' | 'SENDGRID' | 'VAPI' | 'STRIPE' | 'GOOGLE_CALENDAR';
  label: string;
  capability: string;
  enables: string[];
  dependsOn: string[];
  permissions: string;
  fields: Array<{ name: string; label: string; required: boolean }>;
  setupGuide: string;
}

export const INTEGRATION_CATALOG: CatalogEntry[] = [
  {
    key: 'TWILIO',
    label: 'Twilio (SMS & WhatsApp)',
    capability: 'Send and receive SMS/WhatsApp messages',
    enables: ['Inbox SMS replies', 'Campaigns', 'Review requests', 'Booking reminders'],
    dependsOn: [],
    permissions: 'Sofilic uses the credentials only to send/receive messages on your behalf. Message content and delivery errors are stored in your workspace.',
    fields: [
      { name: 'accountSid', label: 'Account SID', required: true },
      { name: 'authToken', label: 'Auth token', required: true },
      { name: 'from', label: 'From number / Messaging Service SID', required: true },
      { name: 'whatsappFrom', label: 'WhatsApp from number', required: false },
    ],
    setupGuide: 'Create API credentials in the Twilio console, then paste the Account SID, Auth token and your sending number.',
  },
  {
    key: 'SENDGRID',
    label: 'SendGrid (Email)',
    capability: 'Send transactional and campaign email',
    enables: ['Email campaigns', 'Password reset delivery', 'Review requests'],
    dependsOn: [],
    permissions: 'Sofilic uses the API key only to send email you compose or approve. Send failures are stored for troubleshooting.',
    fields: [
      { name: 'apiKey', label: 'API key', required: true },
      { name: 'from', label: 'Verified from address', required: true },
    ],
    setupGuide: 'Create a full-access Mail Send API key in SendGrid and verify your sender address first.',
  },
  {
    key: 'VAPI',
    label: 'Vapi (Voice AI)',
    capability: 'AI phone answering with real call records',
    enables: ['Inbound AI phone answering', 'Call transcripts', 'Voice usage metering'],
    dependsOn: [],
    permissions: 'Sofilic reads call events (transcript, duration, cost) from provider webhooks. Recordings stay with the provider unless a URL is reported.',
    fields: [
      { name: 'apiKey', label: 'API key', required: true },
      { name: 'phoneNumberId', label: 'Phone number id', required: false },
      { name: 'assistantId', label: 'Assistant id', required: false },
    ],
    setupGuide: 'Create an API key in the Vapi dashboard, then point the webhook at your workspace URL shown in Voice AI → Setup.',
  },
  {
    key: 'STRIPE',
    label: 'Stripe (Card payments)',
    capability: 'Hosted payment links for YOUR customers',
    enables: ['Invoice payment links', 'Card transactions', 'Portal payment history'],
    dependsOn: [],
    permissions: 'Sofilic creates payment links and reads payment confirmations via webhooks. It never stores card numbers — Stripe hosts the payment page.',
    fields: [
      { name: 'secretKey', label: 'Secret key', required: true },
      { name: 'webhookSecret', label: 'Webhook signing secret', required: false },
    ],
    setupGuide: 'Use a restricted key with Payment Links write access. Add the webhook endpoint shown here to your Stripe dashboard for payment confirmation.',
  },
];

@Injectable()
export class IntegrationCenterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly providers: ProviderFactory,
  ) {}

  /** Full integration center view — all real state, no secrets. */
  async list() {
    const tenantId = tenantContext.tenantId;
    const [comms, rows] = await Promise.all([
      this.providers.commsStatus(tenantId),
      this.prisma.db.integration.findMany(),
    ]);
    const commsFor: Record<string, { configured: boolean; source: string | null }> = {
      TWILIO: comms.sms,
      SENDGRID: comms.email,
      VAPI: comms.voice,
      STRIPE: comms.stripe,
    };
    const results = [] as any[];
    for (const entry of INTEGRATION_CATALOG) {
      const row = rows.find((r) => r.provider === entry.key);
      const c = commsFor[entry.key] ?? { configured: false, source: null };
      const lastSuccessAt = await this.lastActivity(entry.key);
      const hasTenantConfig = !!row?.config && row.status !== 'DISCONNECTED';
      const status = !c.configured
        ? 'not_connected'
        : row?.lastError
          ? 'error'
          : 'connected';
      const health = status === 'connected' ? (lastSuccessAt ? 'healthy' : 'connected_no_activity') : status;
      results.push({
        key: entry.key,
        label: entry.label,
        capability: entry.capability,
        enables: entry.enables,
        dependsOn: entry.dependsOn,
        permissions: entry.permissions,
        fields: entry.fields,
        setupGuide: entry.setupGuide,
        configured: c.configured,
        source: c.source,
        tenantConfigured: hasTenantConfig,
        status,
        health,
        lastSuccessAt,
        lastError: row?.lastError ?? null,
        updatedAt: row?.updatedAt ?? null,
      });
    }
    return results;
  }

  /** Latest REAL provider activity from source-of-truth tables. */
  private async lastActivity(provider: string): Promise<Date | null> {
    const db = this.prisma.db;
    switch (provider) {
      case 'TWILIO': {
        // Conversation carries tenantId, so this stays tenant-scoped by the
        // Prisma extension (Message itself has no tenantId column).
        const c = await db.conversation.findFirst({
          where: { channel: { in: ['SMS', 'WHATSAPP'] }, messages: { some: { direction: 'OUTBOUND', isInternal: false } } },
          orderBy: { lastMessageAt: 'desc' },
          select: { id: true, tenantId: true, lastMessageAt: true },
        });
        return c?.lastMessageAt ?? null;
      }
      case 'SENDGRID': {
        const c = await db.conversation.findFirst({
          where: { channel: 'EMAIL', messages: { some: { direction: 'OUTBOUND', isInternal: false } } },
          orderBy: { lastMessageAt: 'desc' },
          select: { id: true, tenantId: true, lastMessageAt: true },
        });
        return c?.lastMessageAt ?? null;
      }
      case 'VAPI': {
        const c = await db.callRecord.findFirst({ orderBy: { startedAt: 'desc' }, select: { id: true, tenantId: true, startedAt: true } });
        return c?.startedAt ?? null;
      }
      case 'STRIPE': {
        const p = await db.payment.findFirst({ where: { status: 'SUCCEEDED', provider: 'STRIPE', externalRef: { not: 'manual' } }, orderBy: { updatedAt: 'desc' }, select: { id: true, tenantId: true, updatedAt: true } });
        return p?.updatedAt ?? null;
      }
      default:
        return null;
    }
  }

  /** Connect: whitelist + validate fields, encrypt at rest, audit. */
  async connect(providerKey: string, config: Record<string, unknown>) {
    const entry = INTEGRATION_CATALOG.find((e) => e.key === providerKey);
    if (!entry) throw new BadRequestException(`Unknown integration: ${providerKey}`);
    const clean: Record<string, string> = {};
    for (const field of entry.fields) {
      const value = config?.[field.name];
      if (field.required && (typeof value !== 'string' || !value.trim()))
        throw new BadRequestException(`${field.label} is required`);
      if (typeof value === 'string' && value.trim()) clean[field.name] = value.trim();
    }
    const tenantId = tenantContext.tenantId;
    await this.prisma.db.integration.upsert({
      where: { tenantId_provider: { tenantId, provider: entry.key as any } },
      update: { status: 'CONNECTED', config: this.crypto.encryptJson(clean), lastError: null },
      create: { provider: entry.key as any, status: 'CONNECTED', config: this.crypto.encryptJson(clean) } as any,
    });
    await this.audit('integration.connected', entry.key);
    return { connected: true, provider: entry.key, fields: Object.keys(clean) };
  }

  /** Disconnect: clears credentials, keeps history. Audited. */
  async disconnect(providerKey: string) {
    const entry = INTEGRATION_CATALOG.find((e) => e.key === providerKey);
    if (!entry) throw new BadRequestException(`Unknown integration: ${providerKey}`);
    const tenantId = tenantContext.tenantId;
    const row = await this.prisma.db.integration.findFirst({ where: { provider: entry.key as any }, select: { id: true, tenantId: true } });
    if (!row) return { disconnected: true, provider: entry.key, note: 'No tenant credentials were stored (platform-level config, if any, is unaffected).' };
    await this.prisma.db.integration.update({ where: { id: row.id }, data: { status: 'DISCONNECTED', config: null, lastError: null } });
    await this.audit('integration.disconnected', entry.key);
    return { disconnected: true, provider: entry.key };
  }

  /**
   * Genuine credential probe against the provider's own API. Never sends a
   * message or places a call — read-only auth checks only.
   */
  async verify(providerKey: string) {
    const tenantId = tenantContext.tenantId;
    const entry = INTEGRATION_CATALOG.find((e) => e.key === providerKey);
    if (!entry) throw new BadRequestException(`Unknown integration: ${providerKey}`);
    try {
      let ok = false;
      let detail = '';
      if (entry.key === 'VAPI') {
        const adapter = await this.providers.voice(tenantId);
        if (!adapter.listPhoneNumbers) return { ok: false, detail: 'Provider not configured' };
        const numbers = await adapter.listPhoneNumbers();
        ok = numbers.available;
        detail = ok ? `${numbers.numbers.length} phone number(s) on the account` : 'No API key configured';
      } else if (entry.key === 'TWILIO') {
        const creds = await this.rawCreds('TWILIO');
        const sid = creds.accountSid ?? process.env.TWILIO_ACCOUNT_SID;
        const token = creds.authToken ?? process.env.TWILIO_AUTH_TOKEN;
        if (!sid || !token) return { ok: false, detail: 'Not configured' };
        const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}.json`, {
          headers: { Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}` },
        });
        ok = res.ok;
        detail = ok ? 'Credentials verified with Twilio' : `Twilio rejected the credentials (${res.status})`;
      } else if (entry.key === 'SENDGRID') {
        const creds = await this.rawCreds('SENDGRID');
        const key = creds.apiKey ?? process.env.SENDGRID_API_KEY;
        if (!key) return { ok: false, detail: 'Not configured' };
        const res = await fetch('https://api.sendgrid.com/v3/scopes', { headers: { Authorization: `Bearer ${key}` } });
        ok = res.ok;
        detail = ok ? 'Credentials verified with SendGrid' : `SendGrid rejected the key (${res.status})`;
      } else if (entry.key === 'STRIPE') {
        const creds = await this.rawCreds('STRIPE');
        const key = creds.secretKey ?? process.env.STRIPE_SECRET_KEY;
        if (!key) return { ok: false, detail: 'Not configured' };
        const res = await fetch('https://api.stripe.com/v1/account', { headers: { Authorization: `Bearer ${key}` } });
        ok = res.ok;
        detail = ok ? 'Credentials verified with Stripe' : `Stripe rejected the key (${res.status})`;
      }
      // Record the probe outcome on the tenant row (when one exists).
      const row = await this.prisma.db.integration.findFirst({ where: { provider: entry.key as any }, select: { id: true, tenantId: true } });
      if (row) await this.prisma.db.integration.update({ where: { id: row.id }, data: { lastError: ok ? null : detail, status: ok ? 'CONNECTED' : 'ERROR' } });
      return { ok, detail };
    } catch (err) {
      return { ok: false, detail: `Probe failed: ${(err as Error).message.slice(0, 150)}` };
    }
  }

  private async rawCreds(provider: string): Promise<Record<string, any>> {
    const row = await this.prisma.db.integration.findFirst({ where: { provider: provider as any }, select: { id: true, tenantId: true, config: true, status: true } });
    if (row?.config && row.status !== 'DISCONNECTED') return this.crypto.decryptJson(row.config);
    return {};
  }

  private async audit(action: string, provider: string) {
    await this.prisma.db.auditLog.create({
      data: {
        actorId: tenantContext.get()?.userId ?? 'system',
        action,
        entity: 'Integration',
        entityId: provider,
        diff: {},
      } as any,
    });
  }
}
