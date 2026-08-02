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
  patchTenantProfile: (body: { timezone: string }) =>
    request<{ id: string; timezone: string }>(`/tenants/profile`, { method: 'PATCH', body: JSON.stringify(body) }),

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
  employeeTasks: (agentKey?: string) => request<any[]>(`/employees/tasks${agentKey ? `?agentKey=${encodeURIComponent(agentKey)}` : ''}`),
  employeeMetrics: (key: string) => request<any>(`/employees/${key}/metrics`),
  setEmployeeEnabled: (key: string, enabled: boolean) => request(`/employees/${key}/${enabled ? 'enable' : 'disable'}`, { method: 'POST' }),
  installEmployee: (key: string, body: { enabled?: boolean; authority?: 'SUGGEST' | 'APPROVE' | 'AUTONOMOUS' }) =>
    request<any>(`/employees/${key}/install`, { method: 'POST', body: JSON.stringify(body) }),
  patchEmployeeConfig: (key: string, body: Record<string, unknown>) => request(`/employees/${key}/config`, { method: 'PATCH', body: JSON.stringify(body) }),
  runCommand: (text: string) => request<any>(`/employees/command`, { method: 'POST', body: JSON.stringify({ text }) }),
  workforceApprovals: () => request<any[]>(`/employees/approvals`),
  workforceApprovalsRecent: () => request<any[]>(`/employees/approvals/recent`),
  approveAction: (id: string) => request(`/employees/approvals/${id}/approve`, { method: 'POST' }),
  rejectAction: (id: string) => request(`/employees/approvals/${id}/reject`, { method: 'POST' }),
  workforceUsage: () => request<any>(`/employees/usage`),
  aiStatus: () => request<any>(`/employees/ai-status`),

  // Business Brain (Sprint 1)
  brainProfile: () => request<any>(`/business-brain/profile`),
  patchBrainProfile: (body: Record<string, unknown>) =>
    request<any>(`/business-brain/profile`, { method: 'PATCH', body: JSON.stringify(body) }),
  goals: (params?: { status?: string; department?: string }) => {
    const q = new URLSearchParams();
    if (params?.status) q.set('status', params.status);
    if (params?.department) q.set('department', params.department);
    const qs = q.toString();
    return request<any[]>(`/business-brain/goals${qs ? `?${qs}` : ''}`);
  },
  goal: (id: string) => request<any>(`/business-brain/goals/${id}`),
  createGoal: (body: Record<string, unknown>) =>
    request<any>(`/business-brain/goals`, { method: 'POST', body: JSON.stringify(body) }),
  patchGoal: (id: string, body: Record<string, unknown>) =>
    request<any>(`/business-brain/goals/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  setGoalProgress: (id: string, progress: number) =>
    request<any>(`/business-brain/goals/${id}/progress`, { method: 'PATCH', body: JSON.stringify({ progress }) }),
  archiveGoal: (id: string) => request<any>(`/business-brain/goals/${id}`, { method: 'DELETE' }),
  kpis: () => request<any[]>(`/business-brain/kpis`),
  createKpi: (body: Record<string, unknown>) =>
    request<any>(`/business-brain/kpis`, { method: 'POST', body: JSON.stringify(body) }),
  patchKpi: (id: string, body: Record<string, unknown>) =>
    request<any>(`/business-brain/kpis/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  recordKpiValue: (id: string, value: number) =>
    request<any>(`/business-brain/kpis/${id}/value`, { method: 'POST', body: JSON.stringify({ value }) }),
  deleteKpi: (id: string) => request<any>(`/business-brain/kpis/${id}`, { method: 'DELETE' }),
  executiveDashboard: () => request<any>(`/business-brain/executive`),
  // Business Memory reuses the existing Brain knowledge endpoints.
  knowledgeList: () => request<any[]>(`/brain/knowledge`),
  knowledgeIngest: (body: { type: string; title: string; content: string; visibility?: string }) =>
    request<any>(`/brain/knowledge`, { method: 'POST', body: JSON.stringify(body) }),
  knowledgeArchive: (id: string) => request<any>(`/brain/knowledge/${id}`, { method: 'DELETE' }),

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

  // ── Sprint 2: Unified Inbox ──
  conversations: (params?: { status?: string; channel?: string; assigned?: string; unread?: boolean; q?: string }) => {
    const q = new URLSearchParams();
    if (params?.status) q.set('status', params.status);
    if (params?.channel) q.set('channel', params.channel);
    if (params?.assigned) q.set('assigned', params.assigned);
    if (params?.unread) q.set('unread', 'true');
    if (params?.q) q.set('q', params.q);
    const qs = q.toString();
    return request<any[]>(`/conversations${qs ? `?${qs}` : ''}`);
  },
  conversation: (id: string) => request<any>(`/conversations/${id}`),
  conversationChannels: () => request<any[]>(`/conversations/channels`),
  startConversation: (body: Record<string, unknown>) => request<any>(`/conversations`, { method: 'POST', body: JSON.stringify(body) }),
  replyConversation: (id: string, body: string) => request<any>(`/conversations/${id}/reply`, { method: 'POST', body: JSON.stringify({ body }) }),
  noteConversation: (id: string, body: string) => request<any>(`/conversations/${id}/notes`, { method: 'POST', body: JSON.stringify({ body }) }),
  assignConversation: (id: string, body: { userId?: string | null; agentKey?: string | null }) =>
    request<any>(`/conversations/${id}/assign`, { method: 'PATCH', body: JSON.stringify(body) }),
  setConversationStatus: (id: string, status: string) =>
    request<any>(`/conversations/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  markConversationRead: (id: string) => request<any>(`/conversations/${id}/read`, { method: 'POST' }),
  suggestReply: (id: string) => request<any>(`/conversations/${id}/suggest-reply`, { method: 'POST' }),

  // ── Sprint 2: Reviews ──
  reviewsSummary: () => request<any>(`/reviews/summary`),
  reviews: (params?: { responseStatus?: string; minRating?: number; maxRating?: number }) => {
    const q = new URLSearchParams();
    if (params?.responseStatus) q.set('responseStatus', params.responseStatus);
    if (params?.minRating) q.set('minRating', String(params.minRating));
    if (params?.maxRating) q.set('maxRating', String(params.maxRating));
    const qs = q.toString();
    return request<any[]>(`/reviews${qs ? `?${qs}` : ''}`);
  },
  recordReview: (body: Record<string, unknown>) => request<any>(`/reviews`, { method: 'POST', body: JSON.stringify(body) }),
  reviewRequests: () => request<any[]>(`/reviews/requests`),
  sendReviewRequest: (body: { contactId: string; channel?: string; message?: string }) =>
    request<any>(`/reviews/requests`, { method: 'POST', body: JSON.stringify(body) }),
  draftReviewResponse: (id: string) => request<any>(`/reviews/${id}/draft-response`, { method: 'POST' }),
  respondReview: (id: string, responseText: string) =>
    request<any>(`/reviews/${id}/respond`, { method: 'POST', body: JSON.stringify({ responseText }) }),
  dismissReview: (id: string) => request<any>(`/reviews/${id}/dismiss`, { method: 'PATCH' }),
  reviewFollowUp: (id: string) => request<any>(`/reviews/${id}/follow-up`, { method: 'POST', body: JSON.stringify({}) }),

  // ── Sprint 2: Marketing ──
  campaigns: (params?: { status?: string; templates?: boolean }) => {
    const q = new URLSearchParams();
    if (params?.status) q.set('status', params.status);
    if (params?.templates) q.set('templates', 'true');
    const qs = q.toString();
    return request<any[]>(`/marketing/campaigns${qs ? `?${qs}` : ''}`);
  },
  campaign: (id: string) => request<any>(`/marketing/campaigns/${id}`),
  campaignMetrics: (id: string) => request<any>(`/marketing/campaigns/${id}/metrics`),
  createCampaign: (body: Record<string, unknown>) => request<any>(`/marketing/campaigns`, { method: 'POST', body: JSON.stringify(body) }),
  updateCampaign: (id: string, body: Record<string, unknown>) =>
    request<any>(`/marketing/campaigns/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  approveCampaign: (id: string) => request<any>(`/marketing/campaigns/${id}/approve`, { method: 'POST' }),
  startCampaign: (id: string) => request<any>(`/marketing/campaigns/${id}/start`, { method: 'POST' }),
  pauseCampaign: (id: string) => request<any>(`/marketing/campaigns/${id}/pause`, { method: 'POST' }),
  cancelCampaign: (id: string) => request<any>(`/marketing/campaigns/${id}/cancel`, { method: 'POST' }),
  previewAudience: (audience: Record<string, unknown>, channel: string) =>
    request<any>(`/marketing/audience/preview`, { method: 'POST', body: JSON.stringify({ audience, channel }) }),
  aiDraftCampaign: (body: { channel: string; goal?: string; notes?: string }) =>
    request<any>(`/marketing/ai-draft`, { method: 'POST', body: JSON.stringify(body) }),

  // ── Sprint 2: Social ──
  socialPosts: (params?: { status?: string; platform?: string; from?: string; to?: string }) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params ?? {})) if (v) q.set(k, String(v));
    const qs = q.toString();
    return request<any[]>(`/social/posts${qs ? `?${qs}` : ''}`);
  },
  socialConnections: () => request<any[]>(`/social/connections`),
  createSocialPost: (body: Record<string, unknown>) => request<any>(`/social/posts`, { method: 'POST', body: JSON.stringify(body) }),
  updateSocialPost: (id: string, body: Record<string, unknown>) =>
    request<any>(`/social/posts/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  socialAction: (id: string, action: 'submit' | 'approve' | 'reject' | 'cancel') =>
    request<any>(`/social/posts/${id}/${action}`, { method: 'POST' }),
  scheduleSocialPost: (id: string, scheduledFor: string) =>
    request<any>(`/social/posts/${id}/schedule`, { method: 'POST', body: JSON.stringify({ scheduledFor }) }),
  markSocialPublished: (id: string, note?: string) =>
    request<any>(`/social/posts/${id}/mark-published`, { method: 'POST', body: JSON.stringify({ note }) }),
  aiDraftSocial: (body: { platform: string; topic?: string; notes?: string }) =>
    request<any>(`/social/ai-draft`, { method: 'POST', body: JSON.stringify(body) }),
  socialExport: () => request<any>(`/social/export`),

  // ── Sprint 2: Sales / CRM ──
  lead: (id: string) => request<any>(`/leads/${id}`),
  patchLead: (id: string, body: Record<string, unknown>) => request<any>(`/leads/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  moveStageWithOutcome: (id: string, stage: string, extra?: { lostReason?: string; actualValue?: number }) =>
    request(`/leads/${id}/stage`, { method: 'PATCH', body: JSON.stringify({ stage, ...extra }) }),
  contacts: (q?: string) => request<any[]>(`/contacts${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  contact: (id: string) => request<any>(`/contacts/${id}`),
  createContact: (body: Record<string, unknown>) => request<any>(`/contacts`, { method: 'POST', body: JSON.stringify(body) }),
  updateContact: (id: string, body: Record<string, unknown>) =>
    request<any>(`/contacts/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),

  // ── Sprint 2: ROI, automation ops, settings ──
  roi: (days?: number) => request<any>(`/control/roi${days ? `?days=${days}` : ''}`),
  automationEvents: () => request<string[]>(`/automation/events`),
  automationRecipes: () => request<any[]>(`/automation/recipes`),
  automationHistory: (status?: string) => request<any[]>(`/automation/history${status ? `?status=${status}` : ''}`),
  createAutomationRule: (body: Record<string, unknown>) =>
    request<any>(`/automation/rules`, { method: 'POST', body: JSON.stringify(body) }),
  team: () => request<any[]>(`/tenants/team`),
  integrationsStatus: () => request<any[]>(`/tenants/integrations-status`),
  auditHistory: () => request<any[]>(`/tenants/audit`),
  changePreset: (presetKey: string) => request<any>(`/tenants/preset`, { method: 'PATCH', body: JSON.stringify({ presetKey }) }),
  applyOnboarding: (body: Record<string, unknown>) =>
    request<any>(`/tenants/onboarding/apply`, { method: 'POST', body: JSON.stringify(body) }),

  // ── Sprint 2: Payments extras (existing backend, newly wired) ──
  createInvoice: (body: Record<string, unknown>) => request<any>(`/documents/invoices`, { method: 'POST', body: JSON.stringify(body) }),
  createQuote: (body: Record<string, unknown>) => request<any>(`/documents/quotes`, { method: 'POST', body: JSON.stringify(body) }),
  sendDocument: (id: string) => request<any>(`/documents/${id}/send`, { method: 'POST' }),
  acceptQuote: (id: string) => request<any>(`/documents/quotes/${id}/accept`, { method: 'POST' }),
  convertQuote: (id: string) => request<any>(`/documents/quotes/${id}/convert`, { method: 'POST' }),
  recordOfflinePayment: (documentId: string, body?: { amount?: number; method?: string }) =>
    request<any>(`/payments/record/${documentId}`, { method: 'POST', body: JSON.stringify(body ?? {}) }),

  // public marketing site (no auth)
  contactUs: (body: { name: string; email: string; company?: string; topic?: string; message: string; website?: string }) =>
    request<{ ok: true }>(`/public/contact`, { method: 'POST', body: JSON.stringify(body) }),
};
