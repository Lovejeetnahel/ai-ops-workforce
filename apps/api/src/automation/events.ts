/**
 * Canonical domain-event catalog. Everything interesting in the product is one
 * of these. Agents and the automation engine produce and consume them. Keep the
 * names stable — automation rules reference them by string.
 */
export const DomainEvents = {
  // Communications
  CALL_MISSED: 'call.missed',
  CALL_COMPLETED: 'call.completed',
  MESSAGE_RECEIVED: 'message.received',
  MESSAGE_INBOUND: 'message.inbound', // a contact replied (control-loop signal)

  // CRM / pipeline
  LEAD_CREATED: 'lead.created',
  LEAD_STAGE_CHANGED: 'lead.stage_changed',
  LEAD_LOST: 'lead.lost',

  // Scheduling
  BOOKING_REQUESTED: 'booking.requested',
  BOOKING_CONFIRMED: 'booking.confirmed',
  BOOKING_NO_SHOW: 'booking.no_show',

  // Work
  JOB_CREATED: 'job.created',
  JOB_ASSIGNED: 'job.assigned',
  JOB_STAGE_CHANGED: 'job.stage_changed',
  JOB_STATUS_CHANGED: 'job.status_changed',
  JOB_COMPLETED: 'job.completed',

  // Documents & money
  DOCUMENT_GENERATED: 'document.generated',
  DOCUMENT_SENT: 'document.sent',
  QUOTE_ACCEPTED: 'quote.accepted',
  INVOICE_SENT: 'invoice.sent',
  PAYMENT_SUCCEEDED: 'payment.succeeded',

  // Time-based (emitted by schedulers)
  SCHEDULE_RENT_DUE_SOON: 'schedule.rent_due_soon',
  SCHEDULE_LEAD_STALE: 'schedule.lead_stale',
  SCHEDULE_MAINTENANCE_WINDOW: 'schedule.maintenance_window',

  // Customer portal (Phase 4)
  CUSTOMER_MESSAGE_SENT: 'customer.message.sent',
  CUSTOMER_BOOKING_REQUESTED: 'customer.booking.requested',
  NOTIFICATION_CREATED: 'notification.created',
  PORTAL_USER_CREATED: 'portal.user.created',

  // Employee workforce (Phase 5)
  SHIFT_CLOCK_IN: 'shift.clock_in',
  SHIFT_CLOCK_OUT: 'shift.clock_out',
  TIME_BREAK_STARTED: 'time.break_started',
  TIME_BREAK_ENDED: 'time.break_ended',
  JOB_STARTED: 'job.started',
  JOB_TRAVELING: 'job.traveling',
  JOB_ATTACHMENT_ADDED: 'job.attachment_added',
  FIELD_FORM_SUBMITTED: 'field.form_submitted',
  INCIDENT_REPORTED: 'incident.reported',
  JOB_APPROVAL_REQUESTED: 'job.approval_requested',
  JOB_APPROVED: 'job.approved',
  JOB_REWORK_REQUESTED: 'job.rework_requested',
  LOCATION_UPDATED: 'location.updated',
  MATERIAL_USED: 'material.used',
  FIELD_SOS: 'field.sos',

  // AI workforce (Phase 6)
  AGENT_TASK_CREATED: 'agent.task_created',
  AGENT_TASK_COMPLETED: 'agent.task_completed',
  AGENT_TASK_FAILED: 'agent.task_failed',
  AGENT_HANDOFF: 'agent.handoff',
  AGENT_DECISION_MADE: 'agent.decision_made',
  AGENT_INSTALLED: 'agent.installed',

  // Enterprise intelligence & platform (Phase 7)
  PREDICTION_CREATED: 'prediction.created',
  REPORT_GENERATED: 'report.generated',
  WORKFLOW_PUBLISHED: 'workflow.published',
  WORKFLOW_RUN_STARTED: 'workflow.run_started',
  WORKFLOW_RUN_COMPLETED: 'workflow.run_completed',
  FEEDBACK_RECEIVED: 'feedback.received',
} as const;

export type DomainEventName = (typeof DomainEvents)[keyof typeof DomainEvents];

export interface DomainEvent<T = Record<string, unknown>> {
  /** Event name, e.g. "lead.created". */
  name: DomainEventName | string;
  tenantId: string;
  /** Arbitrary payload addressed by automation conditions via dot-paths. */
  payload: T;
  /** Provider event id for idempotency (webhooks), if any. */
  externalId?: string;
  source?: string;
  occurredAt?: string;
  /**
   * Stable id grouping every decision produced from this one triggering event.
   * Set by EventBus.emit if absent; used as part of the DecisionRecord
   * idempotency key so retries don't create duplicate decisions.
   */
  correlationId?: string;
}
