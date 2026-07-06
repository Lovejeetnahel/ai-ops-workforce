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

  // crm
  moduleConfig: () => request<any>(`/config/module`),
  board: () => request<{ stage: string; leads: any[] }[]>(`/leads/board`),
  moveStage: (id: string, stage: string) => request(`/leads/${id}/stage`, { method: 'PATCH', body: JSON.stringify({ stage }) }),

  // enterprise analytics + intelligence
  analytics: (type: string) => request<any>(`/analytics/dashboard/${type}`),
  briefing: () => request<any>(`/intelligence/briefing`),

  // AI workforce
  employees: () => request<any[]>(`/employees`),
  leaderboard: () => request<any[]>(`/employees/leaderboard`),
  runEmployee: (key: string, type: string) => request(`/employees/${key}/run`, { method: 'POST', body: JSON.stringify({ type }) }),

  // marketplace + billing
  marketplace: (type?: string) => request<any[]>(`/marketplace${type ? `?type=${type}` : ''}`),
  installListing: (id: string) => request(`/marketplace/${id}/install`, { method: 'POST' }),
  plans: () => request<any[]>(`/billing/plans`),
  billingSummary: () => request<any>(`/billing/summary`),
};
