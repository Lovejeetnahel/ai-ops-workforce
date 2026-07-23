import { listPresets } from '@aiow/config';

/**
 * SINGLE SOURCE OF TRUTH for what the public website is allowed to claim.
 *
 * Every public page should pull availability from here instead of hardcoding
 * its own "Live" / "Beta" / "Coming soon" claims. When a module moves from
 * beta to live (or a new integration ships), update this file — every public
 * page that references it updates automatically, and no page can silently
 * drift out of sync with another.
 *
 * Status here must match `SOFILIC_STATUS.md` Section 3 (build status table),
 * which is the canonical record of what's actually wired to a real backend.
 * Industries are NOT hardcoded here — they're read live from
 * `@aiow/config`'s `listPresets()`, the same catalog the signup form uses,
 * so the public Industries page can never claim a different count than what
 * a visitor actually sees at signup.
 */

export type Availability = 'live' | 'beta' | 'limited' | 'coming-soon';

export interface StatusEntry {
  key: string;
  label: string;
  status: Availability;
  /** One short honest sentence of context — shown next to the badge. */
  note?: string;
}

export const AVAILABILITY_LABEL: Record<Availability, string> = {
  live: 'Live',
  beta: 'Beta',
  limited: 'Limited',
  'coming-soon': 'Coming soon',
};

/**
 * Modules/workspaces, matched to the Rev-2 frozen navigation and the Phase 2
 * build-status table in SOFILIC_STATUS.md.
 */
export const MODULE_STATUS: StatusEntry[] = [
  { key: 'dashboard', label: 'Dashboard', status: 'live', note: 'Real KPIs, revenue trend and activity feed from your own data.' },
  { key: 'crm', label: 'CRM', status: 'live', note: 'Contacts, companies and tasks wired to your live pipeline.' },
  { key: 'sales', label: 'Sales & Pipeline', status: 'live', note: 'Pipeline board and follow-ups on real leads.' },
  { key: 'automation', label: 'Automation', status: 'live', note: 'Recipes and workflows run against real events, with history.' },
  { key: 'payments', label: 'Payments & Invoicing', status: 'live', note: 'Invoices, estimates, transactions and subscriptions.' },
  { key: 'apps', label: 'Apps (Field Operations, Marketplace)', status: 'live', note: 'Field job tracking and the app marketplace.' },
  { key: 'settings', label: 'Settings', status: 'live', note: 'Business profile and team invitations.' },
  { key: 'voice-ai', label: 'Voice AI', status: 'beta', note: 'Configure your AI voice agent today; automated call answering is rolling out in beta.' },
  { key: 'conversations', label: 'Conversations (unified inbox)', status: 'coming-soon', note: 'Unified voice, SMS, chat and email threads.' },
  { key: 'marketing', label: 'Marketing Studio & Reviews', status: 'coming-soon', note: 'Campaigns, reputation management and review requests.' },
  { key: 'social', label: 'Social Media', status: 'coming-soon', note: 'Brand kit, media library and scheduled posting.' },
  { key: 'websites', label: 'Websites', status: 'coming-soon', note: 'Landing pages, forms, funnels and custom domains.' },
  { key: 'seo', label: 'SEO', status: 'coming-soon' },
];

/** Third-party integrations. Only "live" if a tenant can connect and use it today. */
export const INTEGRATION_STATUS: StatusEntry[] = [
  { key: 'stripe', label: 'Stripe', status: 'live', note: 'Payments, invoicing and payout reconciliation — connect your own Stripe account.' },
  { key: 'twilio', label: 'Twilio', status: 'live', note: 'SMS messaging and missed-call text-back — connect your own Twilio account.' },
  { key: 'sendgrid', label: 'SendGrid', status: 'live', note: 'Transactional email — connect your own SendGrid account.' },
  { key: 'vapi', label: 'Vapi Voice', status: 'beta', note: 'AI phone answering — in beta rollout.' },
  { key: 'google-calendar', label: 'Google Calendar', status: 'coming-soon' },
  { key: 'quickbooks', label: 'QuickBooks / Xero', status: 'coming-soon' },
  { key: 'social-platforms', label: 'Google Business Profile, Facebook, Instagram', status: 'coming-soon' },
  { key: 'zapier', label: 'Zapier & custom webhooks', status: 'coming-soon' },
  { key: 'public-api', label: 'Public REST API', status: 'live', note: 'Scoped API keys with per-key rate limiting over a /v1 surface.' },
];

/** Industries, read live from the same catalog the signup form uses — never hand-maintained. */
export function industryStatusList(): (StatusEntry & { icon: string; tagline: string })[] {
  return listPresets().map((p) => ({
    key: p.key,
    label: p.label,
    icon: p.icon,
    tagline: p.tagline,
    // Every preset in this catalog is selectable and functional at signup today.
    status: 'live' as Availability,
  }));
}

/**
 * Optional apps / paid add-ons (Release 3). The Apps page, Pricing page and
 * Features page ALL read from this one list — the three previously disagreed
 * (Pricing sold Inventory/Fleet/HR as included while Apps said "not
 * available yet"). `planTier` is the plan where the capability belongs once
 * live; it is pricing policy, and anything not `live` must always be shown
 * with its status label, never as a working feature.
 */
export interface AddOnEntry extends StatusEntry {
  /** Route inside the app when live. */
  href?: string;
  /** Plan tier the capability is sold with (policy statement). */
  planTier: string;
  /** True only when a tenant can actually use it in production today. */
  productionReady: boolean;
  description: string;
}

export const OPTIONAL_APP_STATUS: AddOnEntry[] = [
  {
    key: 'field-operations',
    label: 'Field Operations',
    status: 'live',
    href: '/apps/field-operations',
    planTier: 'All plans',
    productionReady: true,
    description: 'Job tracking, dispatch queue and field team status.',
  },
  {
    key: 'inventory',
    label: 'Inventory',
    status: 'coming-soon',
    planTier: 'Business',
    productionReady: false,
    description: 'Parts, stock levels and truck inventory.',
  },
  {
    key: 'fleet',
    label: 'Fleet',
    status: 'coming-soon',
    planTier: 'Business',
    productionReady: false,
    description: 'Vehicles, assignments and maintenance.',
  },
  {
    key: 'hr',
    label: 'HR & Training',
    status: 'coming-soon',
    planTier: 'Pro',
    productionReady: false,
    description: 'Team records, onboarding and training workspaces.',
  },
];

/**
 * AI workforce facts for public copy. Update alongside the API roster in
 * apps/api/src/employees/roster/ — the count is asserted publicly, so it
 * must never drift from the real registry.
 */
export const AI_WORKFORCE_FACTS = {
  employeeRoles: 9, // sales, customer_success, collections, recruiting, operations_manager, marketing, receptionist, executive, command_center
  note: 'Nine AI employee roles ship today, including the Command Center. External-impact actions (messages, documents, payment links) require your approval unless you explicitly grant autonomous authority.',
};

/** Verticals with no preset yet — genuinely not buildable at signup today. */
export const INDUSTRIES_COMING_SOON: { icon: string; label: string }[] = [
  { icon: '💇', label: 'Hair Salons & Barbershops' },
  { icon: '💅', label: 'Nail Salons & Spas' },
  { icon: '🚗', label: 'Auto Repair & Detailing' },
  { icon: '🐕', label: 'Pet Grooming & Boarding' },
  { icon: '🏋️', label: 'Gyms & Studios' },
  { icon: '🩺', label: 'Clinics & Wellness' },
  { icon: '🛡️', label: 'Security Companies' },
  { icon: '🍽️', label: 'Restaurants & Cafes' },
];
