import { IndustryModuleConfig } from '../types';

/**
 * MODULE 1 — Field Services (HVAC, plumbing, electrical, roofing).
 * Optimizes for: instant booking, emergency triage, technician dispatch,
 * quote → invoice, repeat-service follow-up.
 */
export const fieldServices: IndustryModuleConfig = {
  key: 'FIELD_SERVICES',
  label: 'Field Services',
  tagline: 'Answer every call, book every job, dispatch the right tech.',

  entities: [
    { key: 'service_request', singular: 'Service Request', plural: 'Service Requests', backing: 'lead' },
    { key: 'quote_request', singular: 'Quote Request', plural: 'Quote Requests', backing: 'lead' },
    { key: 'technician_job', singular: 'Technician Job', plural: 'Technician Jobs', backing: 'job' },
    { key: 'emergency_call', singular: 'Emergency Call', plural: 'Emergency Calls', backing: 'lead' },
  ],

  pipeline: [
    { value: 'NEW', label: 'New Request', color: '#3b82f6' },
    { value: 'CONTACTED', label: 'Contacted', color: '#8b5cf6' },
    { value: 'QUALIFIED', label: 'Quoted', color: '#f59e0b' },
    { value: 'BOOKED', label: 'Scheduled', color: '#10b981' },
    { value: 'COMPLETED', label: 'Completed', color: '#22c55e' },
    { value: 'LOST', label: 'Lost', color: '#ef4444' },
  ],

  jobStatuses: [
    { value: 'UNSCHEDULED', label: 'Unscheduled', color: '#94a3b8' },
    { value: 'SCHEDULED', label: 'Scheduled', color: '#3b82f6' },
    { value: 'DISPATCHED', label: 'Tech En Route', color: '#f59e0b' },
    { value: 'IN_PROGRESS', label: 'On Site', color: '#8b5cf6' },
    { value: 'ON_HOLD', label: 'Awaiting Parts', color: '#eab308' },
    { value: 'COMPLETED', label: 'Completed', color: '#22c55e' },
    { value: 'CANCELLED', label: 'Cancelled', color: '#ef4444' },
  ],

  labels: {
    contact: 'Customer',
    contacts: 'Customers',
    lead: 'Service Request',
    job: 'Job',
    assignee: 'Technician',
    bookingCta: 'Book a Visit',
    newLead: 'New Service Request',
    company: 'Account',
  },

  intakeFields: [
    { key: 'name', label: 'Full name', type: 'text', required: true, prompt: 'May I have your name?' },
    { key: 'phone', label: 'Callback number', type: 'phone', required: true, prompt: "What's the best number to reach you?" },
    { key: 'serviceType', label: 'Service needed', type: 'select', required: true, options: ['Heating', 'Cooling', 'Plumbing', 'Electrical', 'Roofing', 'Other'], prompt: 'What kind of service do you need today?' },
    { key: 'urgency', label: 'Urgency', type: 'select', required: true, options: ['Emergency', 'As soon as possible', 'This week', 'Flexible'], prompt: 'Is this an emergency, or can it wait a few days?' },
    { key: 'location', label: 'Service address', type: 'address', required: true, prompt: "What's the service address?" },
    { key: 'issue', label: 'Description of issue', type: 'text', required: false, prompt: 'Can you briefly describe the problem?' },
  ],

  templates: [
    {
      key: 'quote', label: 'Service Quote', type: 'QUOTE',
      body: 'Quote for {{contact.name}} at {{job.location}}\nService: {{job.title}}\n{{#each lineItems}}- {{description}}: {{amount}}\n{{/each}}\nTotal: {{total}}\nValid 30 days.',
    },
    {
      key: 'invoice', label: 'Service Invoice', type: 'INVOICE',
      body: 'Invoice #{{document.number}}\n{{contact.name}} — {{job.location}}\nWork performed: {{job.title}}\nTotal due: {{total}}\nThank you for your business.',
    },
  ],

  automations: [
    {
      key: 'missed_call_text_back', name: 'Text back missed callers',
      description: 'When a call is missed, instantly SMS the caller a booking link so the lead is never lost.',
      triggerEvent: 'call.missed', conditions: [], enabledByDefault: true,
      actions: [
        { type: 'SEND_SMS', params: { template: "Hi, sorry we missed your call! Reply here or book a visit: {{bookingUrl}}" } },
        { type: 'TRIGGER_AGENT', params: { agent: 'crm', intent: 'create_lead_from_call' } },
      ],
    },
    {
      key: 'emergency_dispatch', name: 'Emergency fast-track dispatch',
      description: 'Emergency requests are assigned to the nearest on-call tech immediately and the owner is alerted.',
      triggerEvent: 'lead.created',
      conditions: [{ path: 'lead.urgency', op: 'eq', value: 'EMERGENCY' }],
      enabledByDefault: true,
      actions: [
        { type: 'TRIGGER_AGENT', params: { agent: 'dispatch', strategy: 'nearest_oncall' } },
        { type: 'SEND_SMS', params: { to: 'owner', template: '🚨 Emergency {{lead.serviceType}} at {{lead.location}}' } },
      ],
    },
    {
      key: 'post_job_review', name: 'Request review after completion',
      description: 'After a job is completed, wait 2 hours then ask the customer for a review.',
      triggerEvent: 'job.completed', conditions: [], enabledByDefault: true,
      actions: [
        { type: 'WAIT', params: { hours: 2 } },
        { type: 'SEND_SMS', params: { template: 'Thanks for choosing us, {{contact.name}}! How did we do? {{reviewUrl}}' } },
      ],
    },
    {
      key: 'seasonal_reengage', name: 'Re-engage past customers',
      description: 'Re-engage customers 6 months after their last completed job for seasonal maintenance.',
      triggerEvent: 'schedule.maintenance_window', conditions: [], enabledByDefault: false,
      actions: [
        { type: 'SEND_EMAIL', params: { template: 'Time for your seasonal tune-up, {{contact.name}}? Book here: {{bookingUrl}}' } },
      ],
    },
  ],

  agentPersona:
    'You are the friendly front desk for a field-services company. Be fast, ' +
    'reassuring, and efficient. Triage emergencies first, always collect a ' +
    'callback number and service address, and book a visit whenever possible.',
};
