/**
 * Catalog of connectable systems (integration platform). Each entry is metadata;
 * credentials are stored per-tenant in the existing encrypted `Integration`
 * model, and runtime calls go through the existing ports/adapters. This catalog
 * powers the "connect an app" surface and the SDK/connector framework.
 */
export interface ConnectorMeta {
  key: string;
  name: string;
  category: string;
  auth: 'oauth2' | 'api_key' | 'webhook' | 'basic';
}

export const CONNECTOR_CATALOG: ConnectorMeta[] = [
  { key: 'google_workspace', name: 'Google Workspace', category: 'productivity', auth: 'oauth2' },
  { key: 'microsoft_365', name: 'Microsoft 365', category: 'productivity', auth: 'oauth2' },
  { key: 'slack', name: 'Slack', category: 'messaging', auth: 'oauth2' },
  { key: 'teams', name: 'Microsoft Teams', category: 'messaging', auth: 'oauth2' },
  { key: 'zoom', name: 'Zoom', category: 'meetings', auth: 'oauth2' },
  { key: 'calendly', name: 'Calendly', category: 'scheduling', auth: 'api_key' },
  { key: 'quickbooks', name: 'QuickBooks', category: 'accounting', auth: 'oauth2' },
  { key: 'xero', name: 'Xero', category: 'accounting', auth: 'oauth2' },
  { key: 'hubspot', name: 'HubSpot', category: 'crm', auth: 'oauth2' },
  { key: 'salesforce', name: 'Salesforce', category: 'crm', auth: 'oauth2' },
  { key: 'zapier', name: 'Zapier', category: 'automation', auth: 'webhook' },
  { key: 'make', name: 'Make', category: 'automation', auth: 'webhook' },
  { key: 'docusign', name: 'DocuSign', category: 'documents', auth: 'oauth2' },
  { key: 'twilio', name: 'Twilio', category: 'communications', auth: 'api_key' },
  { key: 'stripe', name: 'Stripe', category: 'payments', auth: 'api_key' },
  { key: 'sendgrid', name: 'SendGrid', category: 'email', auth: 'api_key' },
  { key: 'mailgun', name: 'Mailgun', category: 'email', auth: 'api_key' },
  { key: 'anthropic', name: 'Anthropic', category: 'ai', auth: 'api_key' },
  { key: 'openai', name: 'OpenAI', category: 'ai', auth: 'api_key' },
  { key: 'voyage', name: 'Voyage AI', category: 'ai', auth: 'api_key' },
  { key: 'pinecone', name: 'Pinecone', category: 'vector', auth: 'api_key' },
  { key: 'posthog', name: 'PostHog', category: 'analytics', auth: 'api_key' },
  { key: 'sentry', name: 'Sentry', category: 'observability', auth: 'api_key' },
  { key: 'aws', name: 'AWS', category: 'cloud', auth: 'api_key' },
  { key: 'azure', name: 'Azure', category: 'cloud', auth: 'oauth2' },
  { key: 'gcp', name: 'Google Cloud', category: 'cloud', auth: 'oauth2' },
];
