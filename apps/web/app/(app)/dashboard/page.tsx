'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../../../lib/api';

type Tab = 'overview' | 'analytics' | 'reports' | 'custom';

const QUICK_ACTIONS = [
  { href: '/crm', label: 'Add a contact', icon: '◈' },
  { href: '/sales', label: 'View your pipeline', icon: '▲' },
  { href: '/voice-ai', label: 'Set up Voice AI', icon: '◎' },
  { href: '/automation', label: 'Create an automation', icon: '⟳' },
];

const ACTIVITY_ICONS: Record<string, string> = {
  lead: '◈',
  payment: '▭',
  job: '✓',
  conversation: '▤',
  ai: '◎',
};

const money = (n: number) => `$${Math.round(n).toLocaleString()}`;

function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

/** Month-over-month delta chip. Only renders when there is a real prior value to compare. */
function Delta({ current, previous, isMoney }: { current: number; previous: number; isMoney?: boolean }) {
  if (previous <= 0) return <div className="kpi-delta muted">No prior-month data</div>;
  const pct = Math.round(((current - previous) / previous) * 100);
  const cls = pct >= 0 ? 'up' : 'down';
  return (
    <div className={`kpi-delta ${cls}`}>
      {pct >= 0 ? '▲' : '▼'} {Math.abs(pct)}% vs last month ({isMoney ? money(previous) : previous})
    </div>
  );
}

/** Inline SVG area chart in the design-system gold. Renders nothing without ≥2 real points. */
function TrendChart({ series, height = 120 }: { series: { date: string; value: number }[]; height?: number }) {
  const w = 600;
  const path = useMemo(() => {
    if (series.length < 2) return null;
    const max = Math.max(...series.map((p) => p.value), 1);
    const pts = series.map((p, i) => [
      (i / (series.length - 1)) * (w - 8) + 4,
      height - 14 - (p.value / max) * (height - 28),
    ]);
    const line = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
    const area = `${line} L${pts[pts.length - 1][0].toFixed(1)},${height - 4} L${pts[0][0].toFixed(1)},${height - 4} Z`;
    return { line, area };
  }, [series, height]);
  if (!path) return null;
  return (
    <svg viewBox={`0 0 ${w} ${height}`} style={{ width: '100%', height: 'auto', display: 'block' }} role="img" aria-label="Revenue trend">
      <defs>
        <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffc629" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#ffc629" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={path.area} fill="url(#trend-fill)" />
      <path d={path.line} fill="none" stroke="#ffc629" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export default function Dashboard() {
  const [tab, setTab] = useState<Tab>('overview');
  const [businessName, setBusinessName] = useState<string | null>(null);
  // null = loading, false = unavailable (offline / not signed in), object = real data
  const [ov, setOv] = useState<any>(null);
  const [exec, setExec] = useState<any>(null);
  const [saved, setSaved] = useState<any[] | null>(null);
  const [showOnboardingBanner, setShowOnboardingBanner] = useState(false);
  // Sprint 2: the industry preset decides which widgets render and in what order.
  const [widgets, setWidgets] = useState<string[] | null>(null);
  const [brief, setBrief] = useState<any>(null);
  const [bb, setBb] = useState<any>(null); // Business Brain executive (goals/KPIs/insights)

  const widgetOn = (key: string) => widgets === null || widgets.includes(key);

  useEffect(() => {
    try {
      const u = JSON.parse(window.localStorage.getItem('aiow_user') ?? 'null');
      if (u?.tenant?.name) setBusinessName(u.tenant.name);
    } catch {}
    api.moduleConfig().then((cfg) => setWidgets(cfg?.preset?.dashboardWidgets ?? null)).catch(() => setWidgets(null));
    api.briefing().then(setBrief).catch(() => setBrief(false));
    api.executiveDashboard().then(setBb).catch(() => setBb(false));
    api.overview().then(setOv).catch(() => setOv(false));
    api.currentTenant().then((t) => {
      // Only tenants that actually went through this release's signup flow
      // ever have an `onboardingProgress` object at all — a tenant that
      // existed before this release has no such concept and must never see
      // this banner (there's nothing for it to "finish").
      const progress = t?.settings?.onboardingProgress;
      setShowOnboardingBanner(!!progress && !progress.dashboardReached);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (tab === 'analytics' && exec === null) api.analytics('executive').then(setExec).catch(() => setExec(false));
    if (tab === 'custom' && saved === null) api.savedDashboards().then(setSaved).catch(() => setSaved([]));
  }, [tab, exec, saved]);

  const k = ov ? ov.kpis : null;
  const mods = ov ? ov.modules : null;

  const attentionItems = useMemo(() => {
    if (!ov) return [];
    const a = ov.attention;
    const items: { label: string; count: number; href: string; sev: 'err' | 'warn' }[] = [];
    if (a.urgentOpenJobs > 0) items.push({ label: `${a.urgentOpenJobs} urgent job${a.urgentOpenJobs > 1 ? 's' : ''} waiting`, count: a.urgentOpenJobs, href: '/apps/field-operations', sev: 'err' });
    if (a.overdueInvoices > 0) items.push({ label: `${a.overdueInvoices} invoice${a.overdueInvoices > 1 ? 's' : ''} overdue (7+ days unpaid)`, count: a.overdueInvoices, href: '/payments', sev: 'err' });
    if (a.pendingApprovals > 0) items.push({ label: `${a.pendingApprovals} approval${a.pendingApprovals > 1 ? 's' : ''} pending your review`, count: a.pendingApprovals, href: '/apps/field-operations', sev: 'warn' });
    if (a.overdueTasks > 0) items.push({ label: `${a.overdueTasks} task${a.overdueTasks > 1 ? 's' : ''} past due`, count: a.overdueTasks, href: '/crm', sev: 'warn' });
    // Sprint 2 attention feeds — all real, all linkable.
    if (a.unreadConversations > 0) items.push({ label: `${a.unreadConversations} unread conversation${a.unreadConversations > 1 ? 's' : ''}`, count: a.unreadConversations, href: '/conversations', sev: 'warn' });
    if (a.agentApprovalsPending > 0) items.push({ label: `${a.agentApprovalsPending} AI action${a.agentApprovalsPending > 1 ? 's' : ''} waiting for your approval`, count: a.agentApprovalsPending, href: '/ai-workforce', sev: 'warn' });
    if (a.reviewsNeedingResponse > 0) items.push({ label: `${a.reviewsNeedingResponse} review${a.reviewsNeedingResponse > 1 ? 's' : ''} awaiting a response`, count: a.reviewsNeedingResponse, href: '/marketing', sev: 'warn' });
    if (a.socialPendingApproval > 0) items.push({ label: `${a.socialPendingApproval} social post${a.socialPendingApproval > 1 ? 's' : ''} pending approval`, count: a.socialPendingApproval, href: '/social', sev: 'warn' });
    if (a.automationFailures7d > 0) items.push({ label: `${a.automationFailures7d} automation failure${a.automationFailures7d > 1 ? 's' : ''} this week`, count: a.automationFailures7d, href: '/automation', sev: 'err' });
    if (a.failedPayments30d > 0) items.push({ label: `${a.failedPayments30d} failed payment${a.failedPayments30d > 1 ? 's' : ''} (30d)`, count: a.failedPayments30d, href: '/payments', sev: 'err' });
    return items;
  }, [ov]);

  return (
    <>
      <div className="topbar">
        <div>
          <h2 style={{ margin: 0 }}>Dashboard</h2>
          <span className="muted">Your business at a glance — live numbers, not estimates.</span>
        </div>
        {businessName && <span className="badge">{businessName}</span>}
      </div>

      {showOnboardingBanner && (
        <div className="panel glow" style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span>👋 Finish setting up your account — confirm details, see your modules, and add your first lead.</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <Link href="/onboarding" className="btn sm">Continue setup</Link>
            <button className="btn ghost sm" onClick={() => setShowOnboardingBanner(false)}>Dismiss</button>
          </div>
        </div>
      )}

      <div className="tabs">
        <button className={`tab ${tab === 'overview' ? 'active' : ''}`} onClick={() => setTab('overview')}>Overview</button>
        <button className={`tab ${tab === 'analytics' ? 'active' : ''}`} onClick={() => setTab('analytics')}>Analytics</button>
        <button className={`tab ${tab === 'reports' ? 'active' : ''}`} onClick={() => setTab('reports')}>Reports</button>
        <button className={`tab ${tab === 'custom' ? 'active' : ''}`} onClick={() => setTab('custom')}>Custom dashboards</button>
      </div>

      {tab === 'overview' && (
        <>
          {/* Morning Brief — real intelligence briefing, preset-gated */}
          {widgetOn('morningBrief') && brief && brief !== false && typeof brief.briefing === 'string' && brief.briefing.length > 0 && (
            <div className="panel glow" style={{ marginBottom: 16 }}>
              <h3 style={{ marginTop: 0 }}>☀ Morning brief <span className="muted" style={{ fontSize: 11, fontWeight: 400 }}>{brief.date}</span></h3>
              <p style={{ margin: '4px 0', whiteSpace: 'pre-wrap', fontSize: 13.5 }}>{brief.briefing}</p>
            </div>
          )}

          {ov === null && (
            <>
              <div className="grid-kpi" style={{ marginBottom: 20 }}>
                {[0, 1, 2, 3].map((i) => <div className="panel" key={i}><div className="skeleton" style={{ height: 74 }} /></div>)}
              </div>
              <div className="grid-2"><div className="panel"><div className="skeleton" style={{ height: 160 }} /></div><div className="panel"><div className="skeleton" style={{ height: 160 }} /></div></div>
            </>
          )}

          {ov === false && (
            <div className="panel">
              <div className="empty-state" style={{ padding: '40px 16px' }}>
                <div className="e-ico">◔</div>
                <h4>Can&rsquo;t reach your data right now</h4>
                <p>Sign in again or check your connection — nothing is shown here unless it&rsquo;s real.</p>
              </div>
            </div>
          )}

          {ov && k && (
            <>
              {/* KPI cards — core four always; extra cards appear only for capabilities this tenant actually uses */}
              <div className="grid-kpi" style={{ marginBottom: 20 }}>
                <div className="panel">
                  <div className="muted">New leads today</div>
                  <div className="kpi">{k.leadsToday}</div>
                  <div className="kpi-delta muted">{k.leadsThisWeek} in the last 7 days</div>
                </div>
                <div className="panel">
                  <div className="muted">Revenue this month</div>
                  <div className="kpi">{money(k.revenueThisMonth)}</div>
                  <Delta current={k.revenueThisMonth} previous={k.revenuePrevMonth} isMoney />
                </div>
                <div className="panel">
                  <div className="muted">Open conversations</div>
                  <div className="kpi">{k.openConversations}</div>
                  <div className="kpi-delta muted">{mods.conversations ? `${k.voiceCallsThisWeek} voice call${k.voiceCallsThisWeek === 1 ? '' : 's'} this week` : 'No conversations yet'}</div>
                </div>
                <div className="panel">
                  <div className="muted">Pipeline value</div>
                  <div className="kpi">{money(k.pipelineValue)}</div>
                  <div className="kpi-delta muted">{k.openLeads} open lead{k.openLeads === 1 ? '' : 's'}</div>
                </div>
                {mods.bookings && (
                  <div className="panel">
                    <div className="muted">Booked this week</div>
                    <div className="kpi">{k.bookedThisWeek}</div>
                    <div className="kpi-delta muted">Appointments &amp; visits</div>
                  </div>
                )}
                {mods.jobs && (
                  <div className="panel">
                    <div className="muted">Open jobs</div>
                    <div className="kpi">{k.jobsOpen}</div>
                    <div className="kpi-delta muted">{k.jobsCompletedThisMonth} completed this month</div>
                  </div>
                )}
                {mods.automation && (
                  <div className="panel">
                    <div className="muted">Automation activity</div>
                    <div className="kpi">{k.automationEventsThisWeek}</div>
                    <div className="kpi-delta muted">{k.automationRulesEnabled} rule{k.automationRulesEnabled === 1 ? '' : 's'} active</div>
                  </div>
                )}
                {mods.ai && (
                  <div className="panel">
                    <div className="muted">AI tasks this week</div>
                    <div className="kpi">{k.aiTasksThisWeek}</div>
                    <div className="kpi-delta muted">Across your AI employees</div>
                  </div>
                )}
              </div>

              {/* Revenue trend — only with real history */}
              {ov.revenueSeries.length >= 2 && (
                <div className="panel" style={{ marginBottom: 16 }}>
                  <div className="topbar" style={{ marginBottom: 4 }}>
                    <h3 style={{ margin: 0 }}>Revenue — last 30 days</h3>
                    <span className="muted" style={{ fontSize: 12 }}>{money(ov.revenueSeries.reduce((s: number, p: any) => s + p.value, 0))} total</span>
                  </div>
                  <TrendChart series={ov.revenueSeries} />
                </div>
              )}

              <div className="grid-2" style={{ marginBottom: 16 }}>
                <div className="panel">
                  <h3>Recent activity</h3>
                  {ov.recentActivity.length === 0 ? (
                    <div className="empty-state" style={{ padding: '32px 16px' }}>
                      <div className="e-ico">◔</div>
                      <h4>No activity yet</h4>
                      <p>Once you start receiving leads, calls and payments, you&rsquo;ll see them here.</p>
                    </div>
                  ) : (
                    ov.recentActivity.map((a: any) => (
                      <div className="agent-row" key={a.id}>
                        <span className="ico" aria-hidden>{ACTIVITY_ICONS[a.kind] ?? '•'}</span>
                        <span style={{ flex: 1 }}>
                          <strong>{a.title}</strong>
                          {a.detail && <span className="muted"> — {a.detail}</span>}
                        </span>
                        <span className="muted" style={{ whiteSpace: 'nowrap' }}>{timeAgo(a.at)}</span>
                      </div>
                    ))
                  )}
                </div>

                <div className="panel">
                  <h3>Needs attention</h3>
                  {attentionItems.length === 0 ? (
                    <div className="empty-state" style={{ padding: '32px 16px' }}>
                      <div className="e-ico">✓</div>
                      <h4>Nothing needs your attention</h4>
                      <p>Overdue invoices, urgent jobs, pending approvals and late tasks will surface here.</p>
                    </div>
                  ) : (
                    attentionItems.map((i) => (
                      <Link href={i.href} key={i.label} className="agent-row" style={{ textDecoration: 'none', color: 'var(--text)' }}>
                        <span className={`chip ${i.sev}`}>{i.sev === 'err' ? 'Urgent' : 'Review'}</span>
                        <span style={{ flex: 1 }}>{i.label}</span>
                        <span className="muted">→</span>
                      </Link>
                    ))
                  )}
                </div>
              </div>
            </>
          )}

          {/* Sprint 2 snapshots — preset-gated, real data, honest zeros */}
          {ov && (
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', marginBottom: 16 }}>
              {widgetOn('reviews') && (
                <Link href="/marketing" className="panel" style={{ textDecoration: 'none', color: 'var(--text)' }}>
                  <div className="muted">Reviews</div>
                  <div className="kpi">{ov.reviews.averageRating ?? '—'}{ov.reviews.averageRating ? '★' : ''}</div>
                  <div className="kpi-delta muted">{ov.reviews.total} recorded · {ov.reviews.needsResponse} need a response</div>
                </Link>
              )}
              {widgetOn('conversations') && (
                <Link href="/conversations" className="panel" style={{ textDecoration: 'none', color: 'var(--text)' }}>
                  <div className="muted">Inbox</div>
                  <div className="kpi">{ov.attention.unreadConversations}</div>
                  <div className="kpi-delta muted">unread · {ov.attention.waitingConversations} waiting on you</div>
                </Link>
              )}
              {widgetOn('kpis') && (
                <Link href="/marketing" className="panel" style={{ textDecoration: 'none', color: 'var(--text)' }}>
                  <div className="muted">Marketing</div>
                  <div className="kpi">{ov.marketing.activeCampaigns}</div>
                  <div className="kpi-delta muted">active campaigns · {ov.marketing.recipientsSent30d} messages sent (30d)</div>
                </Link>
              )}
              {widgetOn('aiWorkforce') && (
                <Link href="/ai-workforce" className="panel" style={{ textDecoration: 'none', color: 'var(--text)' }}>
                  <div className="muted">AI Workforce</div>
                  <div className="kpi">{ov.kpis.aiTasksThisWeek}</div>
                  <div className="kpi-delta muted">tasks this week · {ov.attention.agentApprovalsPending} awaiting approval</div>
                </Link>
              )}
              {widgetOn('automationHealth') && (
                <Link href="/automation" className="panel" style={{ textDecoration: 'none', color: 'var(--text)' }}>
                  <div className="muted">Automation</div>
                  <div className="kpi">{ov.kpis.automationRulesEnabled}</div>
                  <div className="kpi-delta muted">rules active · {ov.attention.automationFailures7d} failures (7d)</div>
                </Link>
              )}
            </div>
          )}

          {/* AI insights + goals — from the Business Brain executive engine */}
          {widgetOn('aiInsights') && bb && bb !== false && (bb.risks?.length > 0 || bb.recommendations?.length > 0 || bb.goals?.active?.length > 0) && (
            <div className="grid-2" style={{ marginBottom: 16 }}>
              <div className="panel">
                <h3>AI insights</h3>
                {(bb.risks ?? []).slice(0, 3).map((r: any, i: number) => (
                  <div className="agent-row" key={`r-${i}`}><span className="chip err">Risk</span>
                    <span style={{ flex: 1 }}>{typeof r === 'string' ? r : r.title}{r.detail && <span className="muted" style={{ display: 'block', fontSize: 11 }}>{r.detail}</span>}</span></div>
                ))}
                {(bb.recommendations ?? []).slice(0, 3).map((r: any, i: number) => (
                  <div className="agent-row" key={`rec-${i}`}><span className="chip ok">Next</span>
                    <span style={{ flex: 1 }}>{typeof r === 'string' ? r : r.title ?? r.text}{typeof r !== 'string' && r.detail ? <span className="muted" style={{ display: 'block', fontSize: 11 }}>{r.detail}</span> : null}</span></div>
                ))}
                {(bb.risks ?? []).length === 0 && (bb.recommendations ?? []).length === 0 && (
                  <p className="muted" style={{ fontSize: 13 }}>Insights appear as your business data accrues — nothing is invented.</p>
                )}
              </div>
              <div className="panel">
                <h3 style={{ display: 'flex', justifyContent: 'space-between' }}>Goals <Link href="/business-brain" className="muted" style={{ fontSize: 12 }}>Manage →</Link></h3>
                {(bb.goals?.active ?? []).length === 0 ? (
                  <div className="empty-state" style={{ padding: '24px 12px' }}>
                    <div className="e-ico">◉</div><h4>No active goals</h4><p>Set a goal in the Business Brain — your AI employees work toward it.</p>
                  </div>
                ) : (
                  (bb.goals.active ?? []).slice(0, 4).map((g: any) => (
                    <div key={g.id} style={{ marginBottom: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                        <span>{g.title}</span><span className="muted">{g.progress}%</span>
                      </div>
                      <div style={{ height: 6, background: 'rgba(128,128,128,0.2)', borderRadius: 3, marginTop: 4 }}>
                        <div style={{ height: 6, width: `${g.progress}%`, background: '#ffc629', borderRadius: 3 }} />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          <div className="panel">
            <h3>Quick actions</h3>
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
              {QUICK_ACTIONS.map((a) => (
                <Link href={a.href} key={a.href} className="card" style={{ textDecoration: 'none', display: 'block' }}>
                  <span className="ico" style={{ fontSize: 18 }}>{a.icon}</span>
                  <div className="name" style={{ marginTop: 8 }}>{a.label}</div>
                </Link>
              ))}
            </div>
          </div>
        </>
      )}

      {tab === 'analytics' && (
        <>
          {exec === null && <div className="panel"><div className="skeleton" style={{ height: 220 }} /></div>}
          {exec === false && (
            <div className="panel">
              <div className="empty-state" style={{ padding: '40px 16px' }}>
                <div className="e-ico">◔</div>
                <h4>Analytics unavailable</h4>
                <p>We couldn&rsquo;t load your numbers. Check your connection and try again.</p>
              </div>
            </div>
          )}
          {exec && (
            <>
              <div className="grid-kpi" style={{ marginBottom: 20 }}>
                {exec.kpis.map((kpi: any) => (
                  <div className="panel" key={kpi.key}>
                    <div className="muted">{kpi.label}</div>
                    <div className="kpi">
                      {['revenue', 'net_value', 'pipeline_value'].includes(kpi.key) ? money(kpi.value) : kpi.key === 'conversion_rate' ? `${kpi.value}%` : kpi.value}
                    </div>
                    <div className="kpi-delta muted">Last 30 days</div>
                  </div>
                ))}
              </div>
              <div className="panel">
                <h3>Revenue — last 30 days</h3>
                {exec.series.length >= 2 ? (
                  <TrendChart series={exec.series} height={160} />
                ) : (
                  <div className="empty-state" style={{ padding: '32px 16px' }}>
                    <div className="e-ico">▭</div>
                    <h4>Not enough revenue history yet</h4>
                    <p>The trend appears after at least two days of recorded payments in your value ledger.</p>
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}

      {tab === 'reports' && (
        <div className="panel">
          <div className="empty-state" style={{ padding: '40px 16px' }}>
            <div className="e-ico">▤</div>
            <h4>Reports live here soon</h4>
            <p>Exportable and scheduled reports haven&rsquo;t been built yet. Your live KPIs are already real under the Analytics tab.</p>
            <button className="btn ghost sm" onClick={() => setTab('analytics')}>Open Analytics</button>
          </div>
        </div>
      )}

      {tab === 'custom' && (
        <div className="panel">
          {saved === null ? (
            <div className="skeleton" style={{ height: 140 }} />
          ) : saved.length === 0 ? (
            <div className="empty-state" style={{ padding: '40px 16px' }}>
              <div className="e-ico">▦</div>
              <h4>No custom dashboards yet</h4>
              <p>Saved dashboards you build from your own KPIs will appear here. A visual builder is planned — the underlying API already supports them.</p>
            </div>
          ) : (
            <table className="t">
              <thead><tr><th>Name</th><th>Type</th><th>Widgets</th><th>Updated</th></tr></thead>
              <tbody>
                {saved.map((d: any) => (
                  <tr key={d.id}>
                    <td>{d.name}</td>
                    <td className="muted">{d.type}</td>
                    <td className="muted">{d.widgets?.length ?? 0}</td>
                    <td className="muted">{new Date(d.updatedAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </>
  );
}
