import { IndustryModuleConfig } from '../types';

/**
 * MODULE 3 — Service Agencies (immigration, staffing, marketing, accounting).
 * Optimizes for: client intake, document collection, multi-step follow-up
 * sequences, and case/application pipeline tracking.
 */
export const serviceAgencies: IndustryModuleConfig = {
  key: 'SERVICE_AGENCIES',
  label: 'Service Agencies',
  tagline: 'Qualify every lead, collect every document, move every case forward.',

  entities: [
    { key: 'client_lead', singular: 'Client Lead', plural: 'Client Leads', backing: 'lead' },
    { key: 'consultation_request', singular: 'Consultation Request', plural: 'Consultation Requests', backing: 'lead' },
    { key: 'case', singular: 'Case', plural: 'Cases', backing: 'job' },
    { key: 'document_upload', singular: 'Document Upload', plural: 'Document Uploads', backing: 'document' },
  ],

  pipeline: [
    { value: 'NEW', label: 'New Inquiry', color: '#3b82f6' },
    { value: 'CONTACTED', label: 'Consultation Booked', color: '#8b5cf6' },
    { value: 'QUALIFIED', label: 'Retained', color: '#f59e0b' },
    { value: 'BOOKED', label: 'Documents Pending', color: '#10b981' },
    { value: 'COMPLETED', label: 'Case Filed', color: '#22c55e' },
    { value: 'LOST', label: 'Lost', color: '#ef4444' },
  ],

  jobStatuses: [
    { value: 'UNSCHEDULED', label: 'Intake', color: '#94a3b8' },
    { value: 'SCHEDULED', label: 'Documents Requested', color: '#3b82f6' },
    { value: 'DISPATCHED', label: 'Assigned to Caseworker', color: '#f59e0b' },
    { value: 'IN_PROGRESS', label: 'In Preparation', color: '#8b5cf6' },
    { value: 'ON_HOLD', label: 'Awaiting Client Docs', color: '#eab308' },
    { value: 'COMPLETED', label: 'Filed / Delivered', color: '#22c55e' },
    { value: 'CANCELLED', label: 'Withdrawn', color: '#ef4444' },
  ],

  labels: {
    contact: 'Client',
    contacts: 'Clients',
    lead: 'Lead',
    job: 'Case',
    assignee: 'Caseworker',
    bookingCta: 'Book a Consultation',
    newLead: 'New Client Lead',
    company: 'Client Org',
  },

  intakeFields: [
    { key: 'name', label: 'Full name', type: 'text', required: true, prompt: 'May I have your full name?' },
    { key: 'email', label: 'Email', type: 'email', required: true, prompt: "What's the best email to reach you?" },
    { key: 'phone', label: 'Phone', type: 'phone', required: true, prompt: 'And a phone number?' },
    { key: 'serviceType', label: 'Service of interest', type: 'select', required: true, options: ['Immigration', 'Staffing', 'Marketing', 'Accounting', 'Other'], prompt: 'Which service are you interested in?' },
    { key: 'matter', label: 'Brief summary', type: 'text', required: true, prompt: 'Can you briefly describe what you need help with?' },
    { key: 'timeline', label: 'Timeline', type: 'select', required: false, options: ['Urgent', 'Within a month', 'Just exploring'], prompt: 'How soon are you looking to get started?' },
  ],

  templates: [
    {
      key: 'engagement_letter', label: 'Engagement Letter', type: 'CONTRACT',
      body: 'Engagement Letter\nClient: {{contact.name}}\nMatter: {{job.title}}\nScope: {{job.description}}\nFee: {{fee}}\nBy signing you retain our services for the matter above.',
    },
    {
      key: 'document_checklist', label: 'Document Checklist', type: 'FORM',
      body: 'Documents needed for {{job.title}}:\n{{#each checklist}}- [ ] {{this}}\n{{/each}}\nPlease upload via {{uploadUrl}}.',
    },
    {
      key: 'invoice', label: 'Invoice', type: 'INVOICE',
      body: 'Invoice #{{document.number}} for {{contact.name}}\nServices: {{job.title}}\nAmount due: {{total}}',
    },
  ],

  automations: [
    {
      key: 'intake_sequence', name: 'New lead intake sequence',
      description: 'Qualify a new client lead, send a booking link, and start a document checklist.',
      triggerEvent: 'lead.created', conditions: [], enabledByDefault: true,
      actions: [
        { type: 'TRIGGER_AGENT', params: { agent: 'chat', intent: 'qualify_lead' } },
        { type: 'SEND_EMAIL', params: { template: "Thanks for reaching out, {{contact.name}}! Book your consultation here: {{bookingUrl}}" } },
      ],
    },
    {
      key: 'doc_collection', name: 'Document collection chase',
      description: 'When a case is awaiting documents, remind the client every 3 days until uploaded.',
      triggerEvent: 'job.stage_changed',
      conditions: [{ path: 'job.status', op: 'eq', value: 'ON_HOLD' }],
      enabledByDefault: true,
      actions: [
        { type: 'GENERATE_DOCUMENT', params: { template: 'document_checklist' } },
        { type: 'SEND_EMAIL', params: { template: 'Hi {{contact.name}}, we still need a few documents to proceed: {{uploadUrl}}' } },
        { type: 'WAIT', params: { hours: 72 } },
      ],
    },
    {
      key: 'consult_no_show', name: 'Re-book consultation no-shows',
      description: 'If a consultation is missed, offer to reschedule automatically.',
      triggerEvent: 'booking.no_show', conditions: [], enabledByDefault: true,
      actions: [
        { type: 'SEND_SMS', params: { template: 'Sorry we missed you, {{contact.name}}. Grab a new time here: {{bookingUrl}}' } },
      ],
    },
    {
      key: 'lost_reengage', name: 'Re-engage cold leads',
      description: 'Re-engage leads that went quiet after 14 days with a check-in.',
      triggerEvent: 'schedule.lead_stale', conditions: [], enabledByDefault: false,
      actions: [
        { type: 'SEND_EMAIL', params: { template: 'Still need help with your {{lead.serviceType}} matter, {{contact.name}}? We are here when you are ready.' } },
      ],
    },
  ],

  agentPersona:
    'You are the intake coordinator for a professional services agency. Be warm, ' +
    'discreet, and thorough. Qualify the matter, capture contact details and a ' +
    'short summary, book a consultation, and explain that a document checklist ' +
    'will follow. Never give legal, financial, or professional advice.',
};
