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

/** Persists a login/signup/refresh session in the browser. */
export function saveSession(session: { accessToken: string; refreshToken?: string; user: any }) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem('aiow_token', session.accessToken);
  window.localStorage.setItem('aiow_user', JSON.stringify(session.user ?? {}));
  if (session.refreshToken) window.localStorage.setItem('aiow_refresh_token', session.refreshToken);
}

/**
 * Signs the user out. Best-effort revokes the refresh token server-side
 * (fire-and-forget — logout must never hang or fail visibly), then always
 * clears the local session synchronously so the caller can redirect
 * immediately.
 */
export function logout() {
  if (typeof window === 'undefined') return;
  const refreshToken = window.localStorage.getItem('aiow_refresh_token') ?? undefined;
  if (refreshToken) {
    fetch(`${BASE}/api/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
      keepalive: true,
    }).catch(() => undefined);
  }
  window.localStorage.removeItem('aiow_token');
  window.localStorage.removeItem('aiow_refresh_token');
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
    request<{ accessToken: string; refreshToken: string; user: any }>(`/auth/login`, { method: 'POST', body: JSON.stringify({ email, password }) }),
  refreshSession: (refreshToken: string) =>
    request<{ accessToken: string; refreshToken: string; user: any }>(`/auth/refresh`, { method: 'POST', body: JSON.stringify({ refreshToken }) }),
  forgotPassword: (email: string) =>
    request<{ ok: true; message: string }>(`/auth/forgot-password`, { method: 'POST', body: JSON.stringify({ email }) }),
  resetPassword: (token_: string, password: string) =>
    request<{ ok: true }>(`/auth/reset-password`, { method: 'POST', body: JSON.stringify({ token: token_, password }) }),
  signup: (body: {
    name: string;
    firstName: string;
    lastName: string;
    ownerEmail: string;
    ownerPassword: string;
    industryModule: string;
    presetKey?: string;
    country?: string;
    businessSize?: string;
    teamSize?: string;
    termsAccepted: boolean;
    marketingConsent?: boolean;
  }) => request<any>(`/tenants`, { method: 'POST', body: JSON.stringify(body) }),
  industryModules: () => request<{ key: string; label: string; tagline: string }[]>(`/tenants/modules`),
  industryPresets: () =>
    request<{ key: string; engine: string; label: string; tagline: string; icon: string }[]>(`/tenants/presets`),
  inviteStaff: (body: { email: string; password: string; name: string; role: string }) =>
    request<any>(`/tenants/users`, { method: 'POST', body: JSON.stringify(body) }),
  currentTenant: () => request<{ id: string; name: string; slug: string; industryModule: string; timezone: string; settings: any }>(`/tenants/me`),
  updateOnboarding: (body: { completedSteps?: string[]; skipped?: boolean; dashboardReached?: boolean }) =>
    request<any>(`/tenants/onboarding`, { method: 'PATCH', body: JSON.stringify(body) }),

  // crm
  moduleConfig: () => request<any>(`/config/module`),
  board: () => request<{ stage: string; leads: any[] }[]>(`/leads/board`),
  createLead: (body: { contactName: string; phone?: string; email?: string; serviceType?: string; urgency?: string; location?: string }) =>
    request<any>(`/leads`, { method: 'POST', body: JSON.stringify(body) }),
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

  // public marketing site (no auth)
  contactUs: (body: { name: string; email: string; company?: string; topic?: string; message: string; website?: string }) =>
    request<{ ok: true }>(`/public/contact`, { method: 'POST', body: JSON.stringify(body) }),
};
