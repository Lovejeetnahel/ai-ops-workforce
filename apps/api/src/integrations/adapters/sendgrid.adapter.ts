import { Logger } from '@nestjs/common';
import { EmailPort } from '../ports';

/** SendGrid email adapter. Reference implementation over the v3 mail API. */
export class SendgridAdapter implements EmailPort {
  private readonly logger = new Logger(SendgridAdapter.name);

  constructor(private readonly creds: { apiKey: string; from: string }) {}

  async send(input: { to: string; subject: string; html: string; from?: string }) {
    if (!this.creds.apiKey) {
      this.logger.warn(`[stub] EMAIL → ${input.to}: ${input.subject}`);
      return { externalId: `stub_${Date.now()}` };
    }

    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.creds.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: input.to }] }],
        from: { email: input.from ?? this.creds.from },
        subject: input.subject,
        content: [{ type: 'text/html', value: input.html }],
      }),
    });
    if (!res.ok && res.status !== 202) throw new Error(`SendGrid ${res.status}: ${await res.text()}`);
    return { externalId: res.headers.get('x-message-id') ?? `sg_${Date.now()}` };
  }
}
