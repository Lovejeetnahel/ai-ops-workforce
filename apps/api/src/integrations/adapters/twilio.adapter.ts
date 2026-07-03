import { Logger } from '@nestjs/common';
import { SmsPort } from '../ports';

/**
 * Twilio adapter for SMS + WhatsApp. Credentials come from the tenant's
 * Integration row (decrypted), not env, so each business uses its own number.
 *
 * The actual REST call is isolated to `#post()` — drop in the official `twilio`
 * SDK there. Kept as a thin fetch so the scaffold has zero hard SDK deps.
 */
export class TwilioAdapter implements SmsPort {
  private readonly logger = new Logger(TwilioAdapter.name);

  constructor(
    private readonly creds: { accountSid: string; authToken: string; from: string; whatsappFrom?: string },
  ) {}

  async send(input: { to: string; body: string; from?: string; whatsapp?: boolean }) {
    const from = input.whatsapp
      ? `whatsapp:${this.creds.whatsappFrom ?? this.creds.from}`
      : input.from ?? this.creds.from;
    const to = input.whatsapp ? `whatsapp:${input.to}` : input.to;

    if (!this.creds.accountSid) {
      this.logger.warn(`[stub] SMS → ${to}: ${input.body}`); // dev mode without creds
      return { externalId: `stub_${Date.now()}` };
    }

    const res = await this.#post(`Accounts/${this.creds.accountSid}/Messages.json`, {
      To: to,
      From: from,
      Body: input.body,
    });
    return { externalId: res.sid };
  }

  async #post(path: string, form: Record<string, string>): Promise<any> {
    const auth = Buffer.from(`${this.creds.accountSid}:${this.creds.authToken}`).toString('base64');
    const res = await fetch(`https://api.twilio.com/2010-04-01/${path}`, {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(form),
    });
    if (!res.ok) throw new Error(`Twilio ${res.status}: ${await res.text()}`);
    return res.json();
  }
}
