import { IndustryKey } from './types';

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

export interface IndustryPreset {
  /** Stable key persisted in Tenant.settings.onboarding.presetKey. */
  key: string;
  /** The engine (existing IndustryModule enum value) this preset runs on. */
  engine: IndustryKey;
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

/** Compact builder for the 14 field-service presets — same engine, different words. */
function fieldPreset(
  key: string,
  label: string,
  icon: string,
  tagline: string,
  pipelineLabel = 'Pipeline',
  extraLabels: Record<string, string> = {},
): IndustryPreset {
  return {
    key,
    engine: 'FIELD_SERVICES',
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
  field_services: fieldPreset('field_services', 'Field Services (General)', '🚐', 'Any mobile workforce: jobs, zones, skills, dispatch.', 'Pipeline'),
  property_management: {
    key: 'property_management',
    engine: 'PROPERTY_MANAGEMENT',
    label: 'Property Management',
    tagline: 'Tenant requests, vendor dispatch and owner reporting in one place.',
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
  },
  service_agencies: {
    key: 'service_agencies',
    engine: 'SERVICE_AGENCIES',
    label: 'Service Agency',
    tagline: 'Client work, cases and retainers for service firms.',
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
  },
};

export function listPresets(): IndustryPreset[] {
  return Object.values(INDUSTRY_PRESETS);
}

export function getPreset(key: string): IndustryPreset | undefined {
  return INDUSTRY_PRESETS[key];
}
