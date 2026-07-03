import { IndustryModuleConfig } from '../types';

/**
 * MODULE 2 — Property & Facility Management.
 * Optimizes for: tenant maintenance intake, contractor assignment, maintenance
 * tracking, and rent reminders.
 */
export const propertyManagement: IndustryModuleConfig = {
  key: 'PROPERTY_MANAGEMENT',
  label: 'Property & Facility Management',
  tagline: 'Route every tenant request, assign the right contractor, never miss a renewal.',

  entities: [
    { key: 'maintenance_request', singular: 'Maintenance Request', plural: 'Maintenance Requests', backing: 'lead' },
    { key: 'tenant_issue', singular: 'Tenant Issue', plural: 'Tenant Issues', backing: 'lead' },
    { key: 'contractor_job', singular: 'Contractor Job', plural: 'Contractor Jobs', backing: 'job' },
    { key: 'rent_reminder', singular: 'Rent Reminder', plural: 'Rent Reminders', backing: 'job' },
  ],

  pipeline: [
    { value: 'NEW', label: 'Submitted', color: '#3b82f6' },
    { value: 'CONTACTED', label: 'Acknowledged', color: '#8b5cf6' },
    { value: 'QUALIFIED', label: 'Triaged', color: '#f59e0b' },
    { value: 'BOOKED', label: 'Contractor Assigned', color: '#10b981' },
    { value: 'COMPLETED', label: 'Resolved', color: '#22c55e' },
    { value: 'LOST', label: 'Closed / Withdrawn', color: '#ef4444' },
  ],

  jobStatuses: [
    { value: 'UNSCHEDULED', label: 'Pending Assignment', color: '#94a3b8' },
    { value: 'SCHEDULED', label: 'Scheduled', color: '#3b82f6' },
    { value: 'DISPATCHED', label: 'Contractor Assigned', color: '#f59e0b' },
    { value: 'IN_PROGRESS', label: 'Work In Progress', color: '#8b5cf6' },
    { value: 'ON_HOLD', label: 'Awaiting Approval', color: '#eab308' },
    { value: 'COMPLETED', label: 'Resolved', color: '#22c55e' },
    { value: 'CANCELLED', label: 'Cancelled', color: '#ef4444' },
  ],

  labels: {
    contact: 'Tenant',
    contacts: 'Tenants',
    lead: 'Maintenance Request',
    job: 'Work Order',
    assignee: 'Contractor',
    bookingCta: 'Schedule Maintenance',
    newLead: 'New Maintenance Request',
    company: 'Property',
  },

  intakeFields: [
    { key: 'name', label: 'Tenant name', type: 'text', required: true, prompt: 'Can I get your name?' },
    { key: 'phone', label: 'Phone', type: 'phone', required: true, prompt: "What's a good callback number?" },
    { key: 'unit', label: 'Unit / property', type: 'text', required: true, prompt: 'Which unit or property is this for?' },
    { key: 'issueType', label: 'Issue type', type: 'select', required: true, options: ['Plumbing', 'Electrical', 'HVAC', 'Appliance', 'Pest', 'Common area', 'Other'], prompt: 'What seems to be the issue?' },
    { key: 'urgency', label: 'Urgency', type: 'select', required: true, options: ['Emergency (flood/no heat)', 'Urgent', 'Routine'], prompt: 'Is this an emergency such as a flood or no heat?' },
    { key: 'access', label: 'Entry permission', type: 'boolean', required: true, prompt: 'Do we have permission to enter if you are not home?' },
  ],

  templates: [
    {
      key: 'work_order', label: 'Work Order', type: 'FORM',
      body: 'Work Order #{{document.number}}\nProperty/Unit: {{job.location}}\nReported by: {{contact.name}}\nIssue: {{job.description}}\nAssigned contractor: {{job.assignee}}\nAuthorized limit: {{job.metadata.approvedLimit}}',
    },
    {
      key: 'rent_notice', label: 'Rent Reminder Notice', type: 'REPORT',
      body: 'Dear {{contact.name}}, this is a friendly reminder that rent for {{contact.attributes.unit}} is due on {{dueDate}}. Amount: {{amount}}.',
    },
  ],

  automations: [
    {
      key: 'route_request', name: 'Acknowledge & triage tenant requests',
      description: 'When a maintenance request is created, acknowledge the tenant and triage urgency.',
      triggerEvent: 'lead.created', conditions: [], enabledByDefault: true,
      actions: [
        { type: 'SEND_SMS', params: { template: "Hi {{contact.name}}, we've received your request for {{lead.serviceType}} and are reviewing it now." } },
        { type: 'TRIGGER_AGENT', params: { agent: 'crm', intent: 'triage_maintenance' } },
      ],
    },
    {
      key: 'emergency_contractor', name: 'Emergency contractor dispatch',
      description: 'Floods, no-heat and other emergencies are escalated to an on-call contractor immediately.',
      triggerEvent: 'lead.created',
      conditions: [{ path: 'lead.urgency', op: 'eq', value: 'EMERGENCY' }],
      enabledByDefault: true,
      actions: [
        { type: 'TRIGGER_AGENT', params: { agent: 'dispatch', strategy: 'oncall_contractor' } },
        { type: 'SEND_EMAIL', params: { to: 'manager', template: '🚨 Emergency at {{lead.location}}: {{lead.serviceType}}' } },
      ],
    },
    {
      key: 'rent_reminder', name: 'Monthly rent reminders',
      description: 'Send rent reminders 5 days before the due date each month.',
      triggerEvent: 'schedule.rent_due_soon', conditions: [], enabledByDefault: true,
      actions: [
        { type: 'GENERATE_DOCUMENT', params: { template: 'rent_notice' } },
        { type: 'SEND_EMAIL', params: { template: 'Your rent for {{contact.attributes.unit}} is due {{dueDate}}.' } },
      ],
    },
    {
      key: 'resolution_followup', name: 'Confirm resolution',
      description: 'After a work order is completed, confirm the tenant is satisfied.',
      triggerEvent: 'job.completed', conditions: [], enabledByDefault: true,
      actions: [
        { type: 'WAIT', params: { hours: 24 } },
        { type: 'SEND_SMS', params: { template: 'Hi {{contact.name}}, was your {{job.title}} issue fully resolved? Reply YES or NO.' } },
      ],
    },
  ],

  agentPersona:
    'You are the maintenance coordinator for a property management company. Be ' +
    'calm and professional. Always capture the unit/property, confirm entry ' +
    'permission, and escalate emergencies like floods or loss of heat immediately.',
};
