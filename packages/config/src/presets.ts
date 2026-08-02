import { IndustryKey, LeadStage, OperatingCore, StageLabel } from './types';

/**
 * Industry Presets — Phase 1 of the Sofilic blueprint.
 *
 * A preset is pure config layered ON TOP of an IndustryModuleConfig (the
 * "engine"). It supplies the industry-specific label/tagline, vocabulary
 * overrides, grouped navigation (which modules this industry sees), enabled
 * universal workspaces, and hidden modules. Nothing here touches the data
 * model: presets resolve to one of the existing engines at provision time,
 * so every existing tenant and migration keeps working unchanged.
 */

export interface PresetNavItem {
  href: string;
  label: string;
  ico: string;
}

export interface PresetNavGroup {
  title: string;
  links: PresetNavItem[];
}

/** A KPI seeded (with the user's consent, during onboarding) for a preset. */
export interface PresetKpiDefault {
  name: string;
  /** Platform metric key (AnalyticsService) — real data only; null = manual. */
  metricKey: string | null;
  unit?: string;
  direction?: 'UP_IS_GOOD' | 'DOWN_IS_GOOD';
  /** Suggested target — always shown as editable, never silently applied. */
  suggestedTarget?: number;
}

/** One onboarding question a preset asks to configure the tenant. */
export interface PresetOnboardingQuestion {
  key: string;
  label: string;
  type: 'text' | 'select' | 'multiselect' | 'boolean';
  options?: string[];
  /** Where the answer lands: 'profile.services', 'settings.<path>', 'goal'. */
  maps: string;
  optional?: boolean;
}

export interface IndustryPreset {
  /** Stable key persisted in Tenant.settings.onboarding.presetKey. */
  key: string;
  /** The engine (existing IndustryModule enum value) this preset runs on. */
  engine: IndustryKey;
  /** Which of the five technical operating cores this preset runs on. */
  core: OperatingCore;
  label: string;
  tagline: string;
  icon: string;
  /** Label overrides merged over the engine config's labels. */
  labels?: Record<string, string>;
  /** Grouped navigation (Part 5 of the blueprint). Groups with no links are omitted. */
  navGroups: PresetNavGroup[];
  /** Universal workspaces enabled by default for this preset. */
  workspaces: string[];
  /** Module keys that must never render for this preset. */
  hiddenModules: string[];

  // ── Sprint 2 runtime schema — drives the whole in-app experience ──────────
  /** Product modules enabled for this industry (frozen-nav keys). */
  modules: string[];
  /** Dashboard widget keys in display order — the industry-driven dashboard. */
  dashboardWidgets: string[];
  /** CRM/product terminology (merged over labels; alias kept for clarity). */
  terminology: Record<string, string>;
  /** Pipeline stage labels/colors for this specific trade (over engine pipeline). */
  pipelineStages?: StageLabel<LeadStage>[];
  /** Engine automation preset keys recommended for this industry. */
  automationTemplates: string[];
  /** Recommended workflow recipe keys (informational until authored). */
  workflows: string[];
  /** KPI defaults offered during onboarding (real metric keys only). */
  kpiDefaults: PresetKpiDefault[];
  /** AI employee roster keys recommended for this industry (approval-first). */
  aiEmployees: string[];
  /** Preset-driven onboarding questions. */
  onboarding: { questions: PresetOnboardingQuestion[] };
}

/** Shared nav groups every preset gets (Part 5 fixed skeleton). */
const COMMON_GROUPS: Record<'grow' | 'marketing' | 'communication' | 'automate' | 'ai' | 'manage', PresetNavGroup> = {
  grow: {
    title: 'Grow',
    links: [
      { href: '/revenue', label: 'Revenue', ico: '◈' },
      { href: '/analytics', label: 'Analytics', ico: '∿' },
      { href: '/executive', label: 'Executive Briefing', ico: '❖' },
    ],
  },
  marketing: {
    title: 'Marketing',
    links: [
      { href: '/reviews', label: 'Reviews', ico: '★' },
      { href: '/marketing', label: 'Marketing Studio', ico: '◬' },
    ],
  },
  communication: {
    title: 'Communication',
    links: [
      { href: '/inbox', label: 'Inbox', ico: '▤' },
      { href: '/notifications', label: 'Notifications', ico: '◔' },
    ],
  },
  automate: {
    title: 'Automate',
    links: [
      { href: '/automations', label: 'Automations', ico: '⟳' },
      { href: '/workflows', label: 'Workflows', ico: '⇶' },
      { href: '/marketplace', label: 'Marketplace', ico: '▦' },
    ],
  },
  ai: {
    title: 'AI',
    links: [{ href: '/workforce', label: 'AI Workforce', ico: '✦' }],
  },
  manage: {
    title: 'Manage',
    links: [
      { href: '/billing', label: 'Billing', ico: '▭' },
      { href: '/settings', label: 'Settings', ico: '⚙' },
    ],
  },
};

/** The DISPATCH operations group shared by all field-service trades. */
const fieldOps = (pipelineLabel: string): PresetNavGroup => ({
  title: 'Operations',
  links: [
    { href: '/dashboard', label: 'Dashboard', ico: '⌘' },
    { href: '/pipeline', label: pipelineLabel, ico: '▤' },
    { href: '/dispatch', label: 'Dispatch', ico: '➤' },
    { href: '/jobs', label: 'Field Team', ico: '▣' },
    { href: '/portal', label: 'Customer Portal', ico: '◉' },
  ],
});

const FIELD_HIDDEN = ['chairs', 'appointments', 'patrol', 'sites', 'leases', 'units', 'matters', 'classes', 'boarding'];
const FIELD_WORKSPACES = ['reviews', 'communication', 'documents', 'automation', 'analytics', 'ai-workforce', 'voice', 'marketing'];

// ── Sprint 2 shared runtime defaults ─────────────────────────────────────────
// Frozen-nav module keys every industry gets; presets subtract via hiddenModules
// and industry-specific removals — never by inventing new top-level modules.
const ALL_MODULES = ['crm', 'sales', 'conversations', 'voice-ai', 'marketing', 'social', 'websites', 'seo', 'automation', 'payments'];

/** Default dashboard widget order — trimmed per industry below. */
const CORE_WIDGETS = [
  'morningBrief', 'needsAttention', 'revenueSnapshot', 'kpis', 'goals',
  'pipeline', 'conversations', 'reviews', 'aiInsights', 'aiWorkforce',
  'automationHealth', 'payments', 'customerActivity', 'quickActions', 'nextActions',
];

const FIELD_KPIS: PresetKpiDefault[] = [
  { name: 'Monthly revenue', metricKey: 'revenue', unit: '$', direction: 'UP_IS_GOOD' },
  { name: 'New leads (30d)', metricKey: 'leads_new', unit: 'leads', direction: 'UP_IS_GOOD' },
  { name: 'Jobs completed (30d)', metricKey: 'jobs_completed', unit: 'jobs', direction: 'UP_IS_GOOD' },
  { name: 'Lead conversion rate', metricKey: 'conversion_rate', unit: '%', direction: 'UP_IS_GOOD' },
  { name: 'Average job value', metricKey: 'avg_job_value', unit: '$', direction: 'UP_IS_GOOD' },
];

const FIELD_ONBOARDING: PresetOnboardingQuestion[] = [
  { key: 'services', label: 'Which services do you offer?', type: 'text', maps: 'profile.services' },
  { key: 'serviceArea', label: 'What areas do you serve?', type: 'text', maps: 'profile.locations' },
  { key: 'emergency', label: 'Do you take emergency / after-hours calls?', type: 'boolean', maps: 'settings.emergencyService' },
  { key: 'mainGoal', label: 'What is your #1 business goal right now?', type: 'text', maps: 'goal', optional: true },
  { key: 'reviewAsk', label: 'Ask customers for a review after completed work?', type: 'boolean', maps: 'settings.reviewProcess.autoAsk', optional: true },
];

/** Colors follow the design system; per-trade labels come from the builder. */
const fieldStages = (labels: Partial<Record<string, string>> = {}): StageLabel<LeadStage>[] => [
  { value: 'NEW', label: labels.NEW ?? 'New Request', color: '#60a5fa' },
  { value: 'CONTACTED', label: labels.CONTACTED ?? 'Contacted', color: '#fbbf24' },
  { value: 'QUALIFIED', label: labels.QUALIFIED ?? 'Quoted', color: '#a78bfa' },
  { value: 'BOOKED', label: labels.BOOKED ?? 'Booked', color: '#34d399' },
  { value: 'COMPLETED', label: labels.COMPLETED ?? 'Completed', color: '#10b981' },
  { value: 'LOST', label: labels.LOST ?? 'Lost', color: '#f87171', hidden: true },
];

/** Compact builder for the 14 field-service presets — same engine, different words. */
function fieldPreset(
  key: string,
  label: string,
  icon: string,
  tagline: string,
  pipelineLabel = 'Pipeline',
  extraLabels: Record<string, string> = {},
  overrides: Partial<IndustryPreset> = {},
): IndustryPreset {
  return {
    key,
    engine: 'FIELD_SERVICES',
    core: 'DISPATCH',
    label,
    tagline,
    icon,
    labels: extraLabels,
    navGroups: [
      fieldOps(pipelineLabel),
      COMMON_GROUPS.grow,
      COMMON_GROUPS.marketing,
      COMMON_GROUPS.communication,
      COMMON_GROUPS.automate,
      COMMON_GROUPS.ai,
      COMMON_GROUPS.manage,
    ],
    workspaces: FIELD_WORKSPACES,
    hiddenModules: FIELD_HIDDEN,
    modules: ALL_MODULES,
    dashboardWidgets: CORE_WIDGETS,
    terminology: { lead: pipelineLabel.replace(/s$/, ''), pipeline: pipelineLabel, customer: 'Customer', job: 'Job', ...extraLabels },
    pipelineStages: fieldStages({ NEW: `New ${pipelineLabel.replace(/s$/, '')}` }),
    automationTemplates: ['missed_call_text_back', 'emergency_dispatch', 'post_job_review', 'seasonal_reengage'],
    workflows: ['post_job_review', 'seasonal_reengage'],
    kpiDefaults: FIELD_KPIS,
    aiEmployees: ['receptionist', 'sales', 'operations_manager', 'customer_success', 'collections', 'marketing'],
    onboarding: { questions: FIELD_ONBOARDING },
    ...overrides,
  };
}

export const INDUSTRY_PRESETS: Record<string, IndustryPreset> = {
  // ── Field Service engine — the 14 Phase 1 trades ─────────────────
  hvac: fieldPreset('hvac', 'HVAC', '❄️', 'Answer every call, book every job, dispatch the right tech.', 'Service Requests'),
  plumbing: fieldPreset('plumbing', 'Plumbing', '🔧', 'From burst-pipe emergency to paid invoice without a missed call.', 'Service Requests'),
  electrical: fieldPreset('electrical', 'Electrical', '⚡', 'Book service calls and win project quotes around the clock.', 'Work Requests'),
  roofing: fieldPreset('roofing', 'Roofing', '🏠', 'Inspections to insurance to installed roof — one pipeline.', 'Inspections & Quotes'),
  cleaning: fieldPreset('cleaning', 'Cleaning Services', '🧹', 'Recurring schedules, happy crews, five-star clients.', 'Quote Requests'),
  landscaping: fieldPreset('landscaping', 'Landscaping', '🌿', 'Seasonal contracts and route days that run themselves.', 'Quote Requests'),
  pest_control: fieldPreset('pest_control', 'Pest Control', '🐜', 'Treatments, recurring plans and compliance logs in one place.', 'Treatment Requests'),
  locksmith: fieldPreset('locksmith', 'Locksmith', '🔑', 'Win the lockout call in the first sixty seconds.', 'Emergency Queue'),
  appliance_repair: fieldPreset('appliance_repair', 'Appliance Repair', '🔌', 'Diagnose, order parts, return, fix — tracked end to end.', 'Repair Requests'),
  garage_door: fieldPreset('garage_door', 'Garage Door Services', '🚪', 'Emergency repairs and installs booked while you sleep.', 'Service Requests'),
  painting: fieldPreset('painting', 'Painting', '🎨', 'Estimates, crews and follow-ups that fill your calendar.', 'Estimate Requests'),
  pressure_washing: fieldPreset('pressure_washing', 'Pressure Washing', '💦', 'Quote fast, book routes, rebook every season.', 'Quote Requests'),
  window_cleaning: fieldPreset('window_cleaning', 'Window Cleaning', '🪟', 'Recurring routes and commercial contracts on autopilot.', 'Quote Requests'),
  junk_removal: fieldPreset('junk_removal', 'Junk Removal', '🚛', 'Photo quotes, same-day dispatch, instant payment.', 'Pickup Requests'),

  // ── Existing engines kept addressable as presets (backward compatible) ──
  field_services: fieldPreset('field_services', 'General Field Services', '🚐', 'Any mobile workforce: jobs, zones, skills, dispatch.', 'Pipeline'),
  property_management: {
    key: 'property_management',
    engine: 'PROPERTY_MANAGEMENT',
    core: 'COVERAGE',
    label: 'Real Estate',
    tagline: 'Leasing, property management, brokerages and investors — tenant requests, vendor dispatch and owner reporting in one place.',
    icon: '🏢',
    navGroups: [
      {
        title: 'Operations',
        links: [
          { href: '/dashboard', label: 'Dashboard', ico: '⌘' },
          { href: '/pipeline', label: 'Maintenance Requests', ico: '▤' },
          { href: '/dispatch', label: 'Vendor Dispatch', ico: '➤' },
          { href: '/portal', label: 'Tenant Portal', ico: '◉' },
        ],
      },
      COMMON_GROUPS.grow,
      COMMON_GROUPS.marketing,
      COMMON_GROUPS.communication,
      COMMON_GROUPS.automate,
      COMMON_GROUPS.ai,
      COMMON_GROUPS.manage,
    ],
    workspaces: ['reviews', 'communication', 'documents', 'automation', 'analytics', 'ai-workforce', 'voice'],
    hiddenModules: ['chairs', 'appointments', 'patrol', 'classes', 'boarding', 'quotes'],
    modules: ALL_MODULES.filter((m) => m !== 'social'),
    dashboardWidgets: CORE_WIDGETS.filter((w) => w !== 'reviews'),
    terminology: { lead: 'Maintenance Request', pipeline: 'Maintenance Requests', customer: 'Tenant', job: 'Work Order' },
    pipelineStages: [
      { value: 'NEW', label: 'New Request', color: '#60a5fa' },
      { value: 'CONTACTED', label: 'Acknowledged', color: '#fbbf24' },
      { value: 'QUALIFIED', label: 'Triaged', color: '#a78bfa' },
      { value: 'BOOKED', label: 'Vendor Assigned', color: '#34d399' },
      { value: 'COMPLETED', label: 'Resolved', color: '#10b981' },
      { value: 'LOST', label: 'Cancelled', color: '#f87171', hidden: true },
    ],
    automationTemplates: ['route_request', 'emergency_contractor', 'rent_reminder', 'resolution_followup'],
    workflows: ['rent_reminder', 'resolution_followup'],
    kpiDefaults: [
      { name: 'Monthly revenue', metricKey: 'revenue', unit: '$', direction: 'UP_IS_GOOD' },
      { name: 'New requests (30d)', metricKey: 'leads_new', unit: 'requests', direction: 'UP_IS_GOOD' },
      { name: 'Work orders completed (30d)', metricKey: 'jobs_completed', unit: 'orders', direction: 'UP_IS_GOOD' },
      { name: 'Open work orders', metricKey: 'jobs_open', unit: 'orders', direction: 'DOWN_IS_GOOD' },
    ],
    aiEmployees: ['receptionist', 'operations_manager', 'customer_success', 'collections'],
    onboarding: {
      questions: [
        { key: 'portfolio', label: 'How many units/properties do you manage?', type: 'text', maps: 'settings.portfolioSize' },
        { key: 'services', label: 'What property services do you provide?', type: 'text', maps: 'profile.services' },
        { key: 'mainGoal', label: 'What is your #1 business goal right now?', type: 'text', maps: 'goal', optional: true },
      ],
    },
  },
  service_agencies: {
    key: 'service_agencies',
    engine: 'SERVICE_AGENCIES',
    core: 'CASE',
    label: 'Professional Services',
    tagline: 'Client work, cases and retainers for law firms, accountants, consultants and agencies.',
    icon: '💼',
    navGroups: [
      {
        title: 'Operations',
        links: [
          { href: '/dashboard', label: 'Dashboard', ico: '⌘' },
          { href: '/pipeline', label: 'Engagements', ico: '▤' },
          { href: '/portal', label: 'Client Portal', ico: '◉' },
        ],
      },
      COMMON_GROUPS.grow,
      COMMON_GROUPS.marketing,
      COMMON_GROUPS.communication,
      COMMON_GROUPS.automate,
      COMMON_GROUPS.ai,
      COMMON_GROUPS.manage,
    ],
    workspaces: ['reviews', 'communication', 'documents', 'automation', 'analytics', 'ai-workforce'],
    hiddenModules: ['chairs', 'appointments', 'patrol', 'classes', 'boarding', 'dispatch', 'field-app'],
    modules: ALL_MODULES.filter((m) => m !== 'voice-ai'),
    dashboardWidgets: CORE_WIDGETS,
    terminology: { lead: 'Engagement', pipeline: 'Engagements', customer: 'Client', job: 'Matter' },
    pipelineStages: [
      { value: 'NEW', label: 'New Inquiry', color: '#60a5fa' },
      { value: 'CONTACTED', label: 'Consultation', color: '#fbbf24' },
      { value: 'QUALIFIED', label: 'Proposal Sent', color: '#a78bfa' },
      { value: 'BOOKED', label: 'Retained', color: '#34d399' },
      { value: 'COMPLETED', label: 'Delivered', color: '#10b981' },
      { value: 'LOST', label: 'Declined', color: '#f87171', hidden: true },
    ],
    automationTemplates: ['intake_sequence', 'doc_collection', 'consult_no_show', 'lost_reengage'],
    workflows: ['intake_sequence', 'doc_collection'],
    kpiDefaults: [
      { name: 'Monthly revenue', metricKey: 'revenue', unit: '$', direction: 'UP_IS_GOOD' },
      { name: 'New inquiries (30d)', metricKey: 'leads_new', unit: 'inquiries', direction: 'UP_IS_GOOD' },
      { name: 'Inquiry → retained rate', metricKey: 'conversion_rate', unit: '%', direction: 'UP_IS_GOOD' },
      { name: 'Pipeline value', metricKey: 'pipeline_value', unit: '$', direction: 'UP_IS_GOOD' },
    ],
    aiEmployees: ['receptionist', 'sales', 'customer_success', 'collections', 'executive'],
    onboarding: {
      questions: [
        { key: 'practice', label: 'What services / practice areas do you offer?', type: 'text', maps: 'profile.services' },
        { key: 'retainer', label: 'Do you work on retainers?', type: 'boolean', maps: 'settings.retainerBilling', optional: true },
        { key: 'mainGoal', label: 'What is your #1 business goal right now?', type: 'text', maps: 'goal', optional: true },
      ],
    },
  },
};

export function listPresets(): IndustryPreset[] {
  return Object.values(INDUSTRY_PRESETS);
}

export function getPreset(key: string): IndustryPreset | undefined {
  return INDUSTRY_PRESETS[key];
}
