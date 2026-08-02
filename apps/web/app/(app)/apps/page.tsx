'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import { AVAILABILITY_LABEL, OPTIONAL_APP_STATUS } from '../../../lib/product-status';

const MODULE_META: Record<string, { label: string; href: string; desc: string }> = {
  crm: { label: 'CRM', href: '/crm', desc: 'Contacts, companies, tasks and the 360° customer view.' },
  sales: { label: 'Sales', href: '/sales', desc: 'Pipeline board, opportunities and outcomes.' },
  conversations: { label: 'Conversations', href: '/conversations', desc: 'Unified inbox across every channel.' },
  'voice-ai': { label: 'Voice AI', href: '/voice-ai', desc: 'AI phone answering and call transcripts.' },
  marketing: { label: 'Marketing', href: '/marketing', desc: 'Campaigns, templates and reputation.' },
  social: { label: 'Social Media', href: '/social', desc: 'Content planning, approval and calendar.' },
  websites: { label: 'Websites', href: '/websites', desc: 'Your web presence workspace.' },
  seo: { label: 'SEO', href: '/seo', desc: 'Search visibility workspace.' },
  automation: { label: 'Automation', href: '/automation', desc: 'Event-driven rules, recipes and history.' },
  payments: { label: 'Payments', href: '/payments', desc: 'Estimates, invoices and transactions.' },
};

/**
 * Apps — the controlled capability center: which modules the industry preset
 * enables, which integrations are really configured (never pretending), and
 * the optional-apps/marketplace catalog with honest availability.
 */
export default function AppsPage() {
  const [items, setItems] = useState<any[] | null>(null);
  const [filter, setFilter] = useState('');
  const [config, setConfig] = useState<any>(null);
  const [integrations, setIntegrations] = useState<any[] | null>(null);
  const types = ['', 'agent', 'workflow', 'template', 'integration'];

  useEffect(() => {
    api.marketplace(filter || undefined).then((d) => setItems(d ?? [])).catch(() => setItems([]));
  }, [filter]);
  useEffect(() => {
    api.moduleConfig().then(setConfig).catch(() => setConfig(false));
    api.integrationsStatus().then(setIntegrations).catch(() => setIntegrations([]));
  }, []);

  const enabledModules: string[] = config?.preset?.modules ?? Object.keys(MODULE_META);
  const hiddenModules: string[] = config?.preset?.hiddenModules ?? [];

  return (
    <>
      <div className="topbar">
        <div>
          <h2 style={{ margin: 0 }}>Apps</h2>
          <span className="muted">Your capability center — modules, integrations and extensions</span>
        </div>
        {config?.preset && <span className="badge">{config.preset.icon} {config.preset.label}</span>}
      </div>

      {/* Industry modules — driven by the preset */}
      <div className="panel" style={{ marginBottom: 20 }}>
        <h3>Product modules{config?.preset ? ` for ${config.preset.label}` : ''}</h3>
        <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>
          Your industry preset controls which modules are active. All of them run on the same platform, data model and AI foundation.
        </p>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))' }}>
          {Object.entries(MODULE_META).map(([key, m]) => {
            const enabled = enabledModules.includes(key) && !hiddenModules.includes(key);
            return (
              <div className="card" key={key} style={{ opacity: enabled ? 1 : 0.55 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="name">{m.label}</span>
                  {enabled ? <span className="chip ok">Enabled</span> : <span className="chip warn">Not in preset</span>}
                </div>
                <div className="meta" style={{ minHeight: 32, margin: '6px 0 10px' }}>{m.desc}</div>
                {enabled
                  ? <Link href={m.href} className="btn ghost sm">Open</Link>
                  : <button className="btn ghost sm" disabled title="Not part of your industry preset">Hidden by preset</button>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Integrations — honest configured state, no secrets */}
      <div className="panel" style={{ marginBottom: 20 }}>
        <h3>Integrations</h3>
        {integrations === null ? <div className="skeleton" style={{ height: 80 }} /> : (
          integrations.map((i) => (
            <div className="agent-row" key={i.key}>
              <span style={{ flex: 1 }}>
                <strong>{i.label}</strong>
                <span className="muted" style={{ display: 'block', fontSize: 11 }}>Enables: {(i.enables ?? []).join(' · ')}</span>
              </span>
              {i.configured
                ? <span className="chip ok">Connected ({i.source})</span>
                : <span className="chip warn">Setup required</span>}
            </div>
          ))
        )}
        <p className="muted" style={{ fontSize: 11, marginTop: 8 }}>
          Features that need an unconfigured integration say so and refuse to pretend — nothing is simulated. Credentials are configured server-side and never shown here.
        </p>
      </div>

      <div className="panel" style={{ marginBottom: 20 }}>
        <h3>Optional apps</h3>
        <div className="grid">
          {OPTIONAL_APP_STATUS.map((a) => (
            <div className="card" key={a.key}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="name">{a.label}</span>
                <span className={`chip ${a.status === 'live' ? 'ok' : 'warn'}`}>{a.status === 'live' ? 'Available' : AVAILABILITY_LABEL[a.status]}</span>
              </div>
              <div className="meta" style={{ minHeight: 32, margin: '6px 0 10px' }}>{a.description}</div>
              {a.status === 'live' && a.href ? (
                <Link href={a.href} className="btn ghost sm">Open</Link>
              ) : (
                <button className="btn ghost sm" disabled>Coming soon</button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="panel">
        <div className="topbar" style={{ marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>Marketplace</h3>
          <div style={{ display: 'flex', gap: 6 }}>
            {types.map((t) => (
              <button
                key={t || 'all'}
                className="tag"
                style={{ cursor: 'pointer', background: filter === t ? 'var(--accent)' : 'transparent', color: filter === t ? '#0a0a0a' : 'var(--muted)' }}
                onClick={() => setFilter(t)}
              >
                {t || 'all'}
              </button>
            ))}
          </div>
        </div>
        {items === null ? (
          <div className="skeleton" style={{ height: 140 }} />
        ) : items.length === 0 ? (
          <div className="empty-state">
            <div className="e-ico">▦</div>
            <h4>Nothing here yet</h4>
            <p>Installable AI employees, workflows, templates and integrations will appear here.</p>
          </div>
        ) : (
          <div className="grid">
            {items.map((it: any) => (
              <div className="panel" key={it.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <strong>{it.name}</strong>
                  <span className="tag">{it.type}</span>
                </div>
                <div className="muted" style={{ margin: '6px 0', minHeight: 34 }}>{it.description}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="muted">★ {it.ratingAvg ?? '—'} · {it.downloads ?? 0} installs</span>
                  <span>{it.priceCents ? `$${(it.priceCents / 100).toFixed(0)}/mo` : 'Free'}</span>
                </div>
                <button className="btn sm" style={{ marginTop: 10, width: '100%' }} onClick={() => api.installListing(it.id).catch(() => {})}>Install</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
