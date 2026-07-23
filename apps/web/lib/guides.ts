/**
 * Real, truthful product guides served at /resources/[slug]. Every statement
 * here describes shipped behavior — guides are documentation, not marketing.
 * When behavior changes, this file must change with it.
 */

export interface GuideSection {
  h: string;
  paragraphs?: string[];
  bullets?: string[];
}

export interface Guide {
  slug: string;
  icon: string;
  title: string;
  description: string;
  sections: GuideSection[];
}

export const GUIDES: Guide[] = [
  {
    slug: 'getting-started',
    icon: '🚀',
    title: 'Getting started with Sofilic',
    description: 'From signup to a working dashboard: industry setup, onboarding, and your first lead.',
    sections: [
      {
        h: 'Create your account',
        paragraphs: [
          'Sign up at sofilic.com/signup with your name, business name, industry, and a password (at least 8 characters with a letter and a number). You must accept the Terms of Service and Privacy Policy; marketing emails are a separate, optional checkbox that is off by default.',
          'Your industry choice matters: it configures your pipeline stages, vocabulary and starter automations. All 17 industries shown at signup are functional today — the list on the website and the list in the signup form come from the same catalog, so they can never disagree.',
        ],
      },
      {
        h: 'Complete onboarding',
        paragraphs: [
          'After signup you land in a short guided setup: confirm your business details and timezone, optionally invite a teammate, review your installed AI employees, and try one safe Command Center request. Every step is skippable, your progress is saved, and skipping never locks you out of anything — you can return to any step later.',
        ],
      },
      {
        h: 'Your dashboard is real data only',
        paragraphs: [
          'The dashboard computes every number from your own account — leads, revenue, jobs, conversations. A brand-new account shows honest empty states with setup guidance instead of fabricated charts. As soon as you add your first lead or send your first invoice, the numbers appear.',
        ],
      },
      {
        h: 'A good first 30 minutes',
        bullets: [
          'Add one real lead in Sales (or let a missed call create one once Twilio is connected).',
          'Send yourself a test quote from Payments.',
          'Open AI Workforce and read what each employee does before enabling autonomy.',
          'Connect Stripe if you invoice customers.',
        ],
      },
    ],
  },
  {
    slug: 'hiring-your-first-ai-employee',
    icon: '🤖',
    title: 'Hiring your first AI employee',
    description: 'What the nine roles do, how to configure personality and instructions, and what to expect.',
    sections: [
      {
        h: 'The roster',
        paragraphs: [
          'Sofilic ships nine AI employee roles: Sales, Customer Success, Collections, Recruiting, Operations Manager, Marketing, Receptionist, Executive, and the Command Center. Each is listed on the AI Workforce page with its department, current status and real success statistics — an employee with no completed tasks shows "no stats yet," never invented numbers.',
        ],
      },
      {
        h: 'Enable and configure',
        paragraphs: [
          'Each employee can be turned on or off individually. Open Configure to set its personality (how it writes), its goal, and standing instructions (e.g. "never offer discounts above 10%"). These are layered on top of your industry\'s base persona and apply from the employee\'s next task.',
        ],
      },
      {
        h: 'AI must be activated to reason',
        paragraphs: [
          'AI employees need the platform\'s AI provider to be configured. If it is not, the AI Workforce page says so plainly and employees refuse to act rather than fake results. Record-keeping, approvals and usage tracking work either way.',
        ],
      },
      {
        h: 'What employees actually do today',
        bullets: [
          'Sales: scores new leads and drafts/sends follow-ups.',
          'Customer Success: post-job satisfaction checks.',
          'Collections: overdue-invoice reminders by email or SMS.',
          'Marketing: post-job review requests.',
          'Receptionist: answers customer questions grounded in your business knowledge.',
          'Command Center: turns your typed requests into planned, permission-checked actions.',
        ],
      },
    ],
  },
  {
    slug: 'approval-vs-autonomous',
    icon: '✅',
    title: 'Approval vs. autonomous authority',
    description: 'How Sofilic decides when an AI action needs a human, and how approvals work.',
    sections: [
      {
        h: 'Two independent checks',
        paragraphs: [
          'Before any AI employee uses a tool, Sofilic checks two separate things. Permission: is this tool on this employee\'s allowed list at all? Authority: may it act without a human? Both are enforced by the platform itself — an AI cannot talk its way past either.',
        ],
      },
      {
        h: 'The three authority levels',
        bullets: [
          'Autonomous — the employee acts on its own, including outside-impact actions like sending messages.',
          'Approval — internal work happens automatically, but anything with outside impact (SMS, email, sending documents, payment links, dispatching, changing job status) is held for you.',
          'Suggest — the employee may only read and recommend; it can never cause outside impact.',
        ],
      },
      {
        h: 'The approvals queue',
        paragraphs: [
          'Held actions appear under Pending approvals on the AI Workforce page with the exact action, its arguments, the employee\'s reason, and an expiry (7 days). Approving executes exactly that stored action, exactly once — even if two admins click at the same moment. Rejecting is final. Expired approvals can no longer execute.',
        ],
      },
      {
        h: 'Our recommendation',
        paragraphs: [
          'Start new employees on Approval, watch a week of proposals, then grant Autonomous per employee once you trust its judgment. The Command Center defaults to Approval for outside-impact actions.',
        ],
      },
    ],
  },
  {
    slug: 'command-center-guide',
    icon: '🎛️',
    title: 'Command Center guide',
    description: 'Type what you need in plain language; get planned, permission-checked actions.',
    sections: [
      {
        h: 'What it is',
        paragraphs: [
          'The Command Center, at the top of the AI Workforce page, takes a plain-language request — "Show today\'s priorities," "List invoices overdue more than 30 days and draft reminders" — plans the work with your business data, and executes it through the same permission and approval system as every other employee.',
        ],
      },
      {
        h: 'What a run shows you',
        bullets: [
          'What you asked for, verbatim.',
          'The response, plus a table of every action: executed, awaiting your approval, denied, or failed.',
          'A run reference (like cmd_ab12cd34) you can quote to support.',
          'Exact token usage recorded per run in the usage panel.',
        ],
      },
      {
        h: 'Built-in limits',
        paragraphs: [
          'Every run is bounded: limited planning turns and tool calls, a 60-second time cap, a 2,000-character request limit, and 10 runs per minute per account. Duplicate outside-impact actions within one run are automatically suppressed. If AI is not configured, the Command Center says so and takes no actions.',
        ],
      },
      {
        h: 'Good first commands',
        bullets: [
          '"Show today\'s priorities" — reads your live pipeline, bookings and overdue invoices.',
          '"List leads that haven\'t moved past New" — a read-only pipeline check.',
          '"Draft payment reminders for invoices overdue 30+ days" — drafts queue for your approval before anything sends.',
        ],
      },
    ],
  },
  {
    slug: 'security-overview',
    icon: '🔒',
    title: 'Security overview',
    description: 'Tenant isolation, access control, encryption and auditability — in plain language.',
    sections: [
      {
        h: 'Every business is isolated',
        paragraphs: [
          'Every database query is scoped to your business by a fail-closed guard: an operation the guard does not recognize throws an error instead of running unprotected. Cross-account access attempts return nothing.',
        ],
      },
      {
        h: 'Access and secrets',
        bullets: [
          'Role-based access: Owner ⊇ Admin ⊇ Staff, with Customer as a separate portal audience.',
          'Passwords hashed with bcrypt; sessions are short-lived tokens with revocable refresh tokens.',
          'Integration credentials encrypted at rest with AES-256.',
          'Public API access uses scoped keys with per-key rate limits.',
        ],
      },
      {
        h: 'AI actions are governed and logged',
        paragraphs: [
          'AI employees act through one enforced gateway: tool permission, argument validation and authority checks happen in platform code the model cannot influence. Outside-impact actions can require human approval, every decision is recorded with its reason, and AI usage is tracked per call.',
        ],
      },
      {
        h: 'Honest compliance posture',
        paragraphs: [
          'Sofilic does not currently hold a formal compliance certification, and we say so rather than imply otherwise. We provide privacy-supporting tooling — consent records, data export, and erasure workflows to support GDPR/PIPEDA-style requests. The full engineering detail lives on the Security page.',
        ],
      },
    ],
  },
  {
    slug: 'billing-and-payments-setup',
    icon: '💳',
    title: 'Billing & payments setup',
    description: 'Connect Stripe, send invoices with pay links, and keep settlement reconciled.',
    sections: [
      {
        h: 'Connect your own Stripe account',
        paragraphs: [
          'Payments run on your Stripe account, connected in Settings → integrations. Sofilic never pools your funds — Stripe settles to you directly.',
        ],
      },
      {
        h: 'Quotes → invoices → payment',
        bullets: [
          'Create quotes and invoices in Payments (or convert a completed job into a draft invoice).',
          'Send an invoice to attach a Stripe pay link.',
          'When the customer pays, the webhook marks the invoice settled and books the revenue — payment links are guarded against double-sending, and settlement is verified against Stripe\'s signature so a forged notification cannot mark an invoice paid.',
          'Cash or e-transfer? Record an offline payment against the invoice.',
        ],
      },
      {
        h: 'Where the numbers go',
        paragraphs: [
          'Settled revenue feeds your dashboard KPIs and the per-AI-employee ROI figures — the same ledger everywhere, so totals always agree.',
        ],
      },
    ],
  },
  {
    slug: 'public-api-introduction',
    icon: '🔌',
    title: 'Public API introduction',
    description: 'Scoped keys, rate limits, and what you can build against the /v1 surface.',
    sections: [
      {
        h: 'Keys and scopes',
        paragraphs: [
          'Owners can issue API keys with explicit scopes — a key only reaches the resources its scopes name, and each key carries its own rate limit (default 120 requests/minute). Keys are shown once at creation; store them like passwords.',
        ],
      },
      {
        h: 'What the API covers',
        paragraphs: [
          'The /v1 REST surface covers core business objects — leads, jobs, invoices and account data — always scoped to your business. The self-describing OpenAPI document is available inside the app (Developer section), generated from the running API rather than hand-maintained.',
        ],
      },
      {
        h: 'Good practices',
        bullets: [
          'One key per integration, minimum scopes each.',
          'Handle 429 responses by backing off — limits are per key, per minute.',
          'Rotate keys when staff or vendors change.',
        ],
      },
    ],
  },
  {
    slug: 'troubleshooting-signup-login',
    icon: '🧰',
    title: 'Troubleshooting signup & login',
    description: 'The most common account issues and exactly how to resolve them.',
    sections: [
      {
        h: '"An account with that email already exists"',
        paragraphs: [
          'Each email can own one business account. If that\'s you, sign in instead — or use Forgot password if you don\'t remember it. Staff invitations are separate and don\'t conflict with owning an account elsewhere.',
        ],
      },
      {
        h: 'Password requirements',
        paragraphs: [
          'At least 8 characters with at least one letter and one number, and the confirmation must match. The form tells you which rule failed — it never fails silently.',
        ],
      },
      {
        h: 'Password reset link problems',
        bullets: [
          'Links expire after 1 hour and work exactly once — request a fresh one if yours is stale.',
          'The "check your email" screen is deliberately identical whether or not an account exists; that\'s an anti-enumeration protection, not an error.',
          'Resetting logs out every signed-in device, on purpose.',
        ],
      },
      {
        h: 'Rate limits and server errors',
        paragraphs: [
          'Repeated attempts are rate-limited (login: 10/minute; reset requests: 5/minute) — wait a minute and retry. If you ever see "something went wrong on our side" with a reference code like err_xxxxxxxx, quote that code to support: it points us at the exact server-side record of what happened, without exposing any of your data.',
        ],
      },
      {
        h: '"This account is not active"',
        paragraphs: [
          'The email and password were correct, but the account is suspended. Contact support to restore access.',
        ],
      },
    ],
  },
];

export function getGuide(slug: string): Guide | undefined {
  return GUIDES.find((g) => g.slug === slug);
}
