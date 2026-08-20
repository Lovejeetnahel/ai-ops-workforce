/**
 * Sprint 4: the single plan catalog with real runtime limits. This is CONFIG,
 * not fabricated data — Stripe price ids are wired per environment via env
 * vars so no fake price ever reaches a checkout. Every limit here is enforced
 * by EntitlementsService against live counts from source-of-truth tables.
 */
export interface PlanLimits {
  staffSeats: number;
  locations: number;
  aiEmployees: number;
  aiTasksMonthly: number;
  voiceMinutesMonthly: number;
  messagesMonthly: number;
  contacts: number;
  automationRules: number;
  campaignsMonthly: number;
  sites: number;
  portalUsers: number;
  apiKeys: number;
}

export interface PlanDef {
  key: string;
  name: string;
  priceCents: number;
  seats: number;
  includedAiTasks: number;
  features: string[];
  /** Env var that holds this plan's Stripe Price id (never hardcoded). */
  stripePriceEnv: string;
  limits: PlanLimits;
}

export const TRIAL_DAYS = 14;
/** Days of grace after a failed payment before gated writes lock. */
export const PAST_DUE_GRACE_DAYS = 14;

export const PLANS: PlanDef[] = [
  {
    key: 'starter',
    name: 'Starter',
    priceCents: 9900,
    seats: 3,
    includedAiTasks: 1000,
    features: ['CRM', 'Scheduling', 'Invoicing', '1 AI employee'],
    stripePriceEnv: 'STRIPE_PRICE_STARTER',
    limits: {
      staffSeats: 3,
      locations: 1,
      aiEmployees: 1,
      aiTasksMonthly: 1000,
      voiceMinutesMonthly: 100,
      messagesMonthly: 500,
      contacts: 1000,
      automationRules: 10,
      campaignsMonthly: 4,
      sites: 1,
      portalUsers: 100,
      apiKeys: 1,
    },
  },
  {
    key: 'pro',
    name: 'Pro',
    priceCents: 29900,
    seats: 15,
    includedAiTasks: 10000,
    features: ['Everything in Starter', 'Full AI workforce', 'Analytics', 'Workflows'],
    stripePriceEnv: 'STRIPE_PRICE_PRO',
    limits: {
      staffSeats: 15,
      locations: 5,
      aiEmployees: 9,
      aiTasksMonthly: 10000,
      voiceMinutesMonthly: 1000,
      messagesMonthly: 5000,
      contacts: 25000,
      automationRules: 100,
      campaignsMonthly: 30,
      sites: 3,
      portalUsers: 2500,
      apiKeys: 5,
    },
  },
  {
    key: 'enterprise',
    name: 'Enterprise',
    priceCents: 99900,
    seats: 100,
    includedAiTasks: 100000,
    features: ['Everything in Pro', 'Multi-company', 'API + webhooks', 'SSO (roadmap)', 'Priority support'],
    stripePriceEnv: 'STRIPE_PRICE_ENTERPRISE',
    limits: {
      staffSeats: 100,
      locations: 50,
      aiEmployees: 9,
      aiTasksMonthly: 100000,
      voiceMinutesMonthly: 10000,
      messagesMonthly: 50000,
      contacts: 250000,
      automationRules: 1000,
      campaignsMonthly: 365,
      sites: 10,
      portalUsers: 25000,
      apiKeys: 25,
    },
  },
];

export type LimitKey = keyof PlanLimits;

export function planByKey(key: string | null | undefined): PlanDef | null {
  return PLANS.find((p) => p.key === key) ?? null;
}

/** Cheapest plan whose limit for `key` exceeds `needed` — the upgrade target. */
export function upgradeTargetFor(key: LimitKey, needed: number): PlanDef | null {
  return PLANS.find((p) => p.limits[key] > needed) ?? null;
}
