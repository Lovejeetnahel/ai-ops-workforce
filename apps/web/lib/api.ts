/**
 * Typed API client. Reads the JWT from localStorage (set at login) and sends it
 * as a Bearer token; the API derives the tenant from the token. Every call is
 * resilient — callers fall back to a sensible empty/demo state when offline.
 */
const BASE = process.env.WEB_PUBLIC_API_URL ?? 'http://localhost:4000';

function token(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem('aiow_token');
}

export function isAuthed(): boolean {
  return token() !== null;
}

export function logout() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem('aiow_token');
  window.localStorage.removeItem('aiow_user');
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}/api${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token() ? { Authorization: `Bearer ${token()}` } : {}),
      ...(init?.headers ?? {}),
    },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json() as Promise<T>;
}

export const api = {
  // auth + onboarding
  login: (email: string, password: string) =>
    request<{ accessToken: string; user: any }>(`/auth/login`, { method: 'POST', body: JSON.stringify({ email, password }) }),
  signup: (body: {
    name: string;
    ownerEmail: string;
    ownerPassword: string;
    industryModule: string;
    presetKey?: string;
    country?: string;
    businessSize?: string;
    teamSize?: string;
  }) => request<any>(`/tenants`, { method: 'POST', body: JSON.stringify(body) }),
  industryModules: () => request<{ key: string; label: string; tagline: string }[]>(`/tenants/modules`),
  industryPresets: () =>
    request<{ key: string; engine: string; label: string; tagline: string; icon: string }[]>(`/tenants/presets`),
  inviteStaff: (body: { email: string; password: string; name: string; role: string }) =>
    request<any>(`/tenants/users`, { method: 'POST', body: JSON.stringify(body) }),

  // crm
  moduleConfig: () => request<any>(`/config/module`),
  board: () => request<{ stage: string; leads: any[] }[]>(`/leads/board`),
  moveStage: (id: string, stage: string) => request(`/leads/${id}/stage`, { method: 'PATCH', body: JSON.stringify({ stage }) }),
  companies: (q?: string) => request<any[]>(`/companies${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  createCompany: (body: { name: string; domain?: string; phone?: string; email?: string; website?: string }) =>
    request<any>(`/companies`, { method: 'POST', body: JSON.stringify(body) }),
  tasks: (status?: string) => request<any[]>(`/activities/tasks${status ? `?status=${status}` : ''}`),
  createTask: (body: { type: string; title: string; body?: string; dueAt?: string; leadId?: string }) =>
    request<any>(`/activities`, { method: 'POST', body: JSON.stringify(body) }),
  completeTask: (id: string) => request(`/activities/${id}/complete`, { method: 'POST' }),

  // enterprise analytics + intelligence
  overview: () => request<any>(`/analytics/overview`),
  analytics: (type: string) => request<any>(`/analytics/dashboard/${type}`),
  savedDashboards: () => request<any[]>(`/analytics/dashboards`),
  briefing: () => request<any>(`/intelligence/briefing`),

  // AI workforce
  employees: () => request<any[]>(`/employees`),
  leaderboard: () => request<any[]>(`/employees/leaderboard`),
  runEmployee: (key: string, type: string) => request(`/employees/${key}/run`, { method: 'POST', body: JSON.stringify({ type }) }),

  // automation
  automationRules: () => request<any[]>(`/automation/rules`),
  toggleAutomationRule: (id: string, enabled: boolean) =>
    request(`/automation/rules/${id}`, { method: 'PATCH', body: JSON.stringify({ enabled }) }),
  workflows: () => request<any[]>(`/workflows`),
  workflowRuns: (id: string) => request<any[]>(`/workflows/${id}/runs`),

  // payments
  documents: (type?: string) => request<any[]>(`/documents${type ? `?type=${type}` : ''}`),
  paymentsList: (status?: string) => request<any[]>(`/payments${status ? `?status=${status}` : ''}`),

  // field operations
  jobs: (status?: string) => request<any[]>(`/jobs${status ? `?status=${status}` : ''}`),
  updateJobStatus: (id: string, status: string) => request(`/jobs/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),

  // marketplace + billing
  marketplace: (type?: string) => request<any[]>(`/marketplace${type ? `?type=${type}` : ''}`),
  installListing: (id: string) => request(`/marketplace/${id}/install`, { method: 'POST' }),
  plans: () => request<any[]>(`/billing/plans`),
  billingSummary: () => request<any>(`/billing/summary`),
};
