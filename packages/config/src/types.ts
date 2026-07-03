/**
 * Industry Module Config — the single abstraction that makes one codebase serve
 * three verticals. A Tenant's `industryModule` selects one of these configs; the
 * API and UI read vocabulary, pipeline, intake, templates and automation presets
 * from it at runtime. Changing a tenant's module re-skins the whole product with
 * zero code changes.
 */

export type IndustryKey =
  | 'FIELD_SERVICES'
  | 'PROPERTY_MANAGEMENT'
  | 'SERVICE_AGENCIES';

/** Generic pipeline stages (mirror Prisma LeadStage); config supplies labels. */
export type LeadStage =
  | 'NEW'
  | 'CONTACTED'
  | 'QUALIFIED'
  | 'BOOKED'
  | 'COMPLETED'
  | 'LOST';

/** Generic job statuses (mirror Prisma JobStatus); config supplies labels. */
export type JobStatus =
  | 'UNSCHEDULED'
  | 'SCHEDULED'
  | 'DISPATCHED'
  | 'IN_PROGRESS'
  | 'ON_HOLD'
  | 'COMPLETED'
  | 'CANCELLED';

/** Maps a generic stage/status to vertical-specific presentation. */
export interface StageLabel<T extends string> {
  value: T;
  label: string;
  color: string; // hex or token used by the pipeline board
  /** Hidden stages are still valid in the DB but not shown as columns. */
  hidden?: boolean;
}

/** A field the Voice/Chat intake agents must collect for this vertical. */
export interface IntakeField {
  key: string;
  label: string;
  type: 'text' | 'phone' | 'email' | 'select' | 'address' | 'date' | 'boolean';
  required: boolean;
  options?: string[];
  /** Natural-language prompt the voice/chat agent uses to ask for it. */
  prompt: string;
}

/** The vertical's name for a Lead and for a Job (and other entities). */
export interface EntityVocabulary {
  /** e.g. "service_request" — persisted as Lead.entityType / Job.entityType. */
  key: string;
  /** Singular label, e.g. "Service Request". */
  singular: string;
  plural: string;
  /** Where it lives in the generic model. */
  backing: 'lead' | 'job' | 'document';
}

/** A document the Document agent can generate for this vertical. */
export interface DocumentTemplate {
  key: string;
  label: string;
  type: 'INVOICE' | 'QUOTE' | 'FORM' | 'CONTRACT' | 'REPORT';
  /** Handlebars-style body rendered to PDF; tokens resolved from job/contact. */
  body: string;
}

/** Action types the automation engine knows how to execute. */
export type AutomationActionType =
  | 'SEND_SMS'
  | 'SEND_EMAIL'
  | 'SEND_WHATSAPP'
  | 'CREATE_TASK'
  | 'ASSIGN_STAFF'
  | 'UPDATE_STAGE'
  | 'CREATE_BOOKING'
  | 'GENERATE_DOCUMENT'
  | 'TRIGGER_AGENT'
  | 'WAIT';

export interface AutomationAction {
  type: AutomationActionType;
  params: Record<string, unknown>;
}

/** A JSON-logic-ish condition evaluated against the event payload. */
export interface AutomationCondition {
  path: string; // dot-path into the event payload, e.g. "lead.urgency"
  op: 'eq' | 'neq' | 'in' | 'gt' | 'lt' | 'exists' | 'contains';
  value?: unknown;
}

/** A ready-made automation seeded for every tenant on this module. */
export interface AutomationPreset {
  key: string;
  name: string;
  description: string;
  triggerEvent: string; // e.g. "call.missed"
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  /** Seeded enabled by default? */
  enabledByDefault: boolean;
}

export interface IndustryModuleConfig {
  key: IndustryKey;
  label: string;
  /** Short marketing/positioning line shown in onboarding. */
  tagline: string;

  /** What we call leads/jobs/etc in this vertical. */
  entities: EntityVocabulary[];

  /** Pipeline board columns. */
  pipeline: StageLabel<LeadStage>[];

  /** Job lifecycle labels. */
  jobStatuses: StageLabel<JobStatus>[];

  /** Arbitrary UI string overrides (button text, nav labels, etc). */
  labels: Record<string, string>;

  /** Fields the inbound agents collect before booking. */
  intakeFields: IntakeField[];

  /** Documents the Document agent can produce. */
  templates: DocumentTemplate[];

  /** Automations seeded for new tenants on this module. */
  automations: AutomationPreset[];

  /** System-prompt persona shared by Voice + Chat agents for this vertical. */
  agentPersona: string;
}
