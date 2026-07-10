'use client';
import { useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import { useToast } from '../../../components/Toast';

type Tab = 'recipes' | 'workflows' | 'history';

export default function AutomationPage() {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('recipes');
  const [rules, setRules] = useState<any[] | null>(null);
  const [flows, setFlows] = useState<any[] | null>(null);
  const [runs, setRuns] = useState<any[] | null>(null);
  const [selectedFlow, setSelectedFlow] = useState<string | null>(null);

  useEffect(() => {
    api.automationRules().then(setRules).catch(() => setRules([]));
    api.workflows().then((f) => {
      setFlows(f ?? []);
      if (f?.length) setSelectedFlow(f[0].id);
    }).catch(() => setFlows([]));
  }, []);

  useEffect(() => {
    if (tab === 'history' && selectedFlow) {
      api.workflowRuns(selectedFlow).then(setRuns).catch(() => setRuns([]));
    }
  }, [tab, selectedFlow]);

  const toggleRule = async (id: string, enabled: boolean) => {
    try {
      await api.toggleAutomationRule(id, enabled);
      setRules((prev) => prev!.map((r) => (r.id === id ? { ...r, enabled } : r)));
      toast.success(enabled ? 'Rule enabled' : 'Rule disabled');
    } catch {
      toast.error('Could not update rule');
    }
  };

  return (
    <>
      <div className="topbar">
        <div>
          <h2 style={{ margin: 0 }}>Automation</h2>
          <span className="muted">Quick recipes and branching workflows, built on the same automation system</span>
        </div>
        <button className="btn sm">+ New automation</button>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === 'recipes' ? 'active' : ''}`} onClick={() => setTab('recipes')}>Recipes</button>
        <button className={`tab ${tab === 'workflows' ? 'active' : ''}`} onClick={() => setTab('workflows')}>Workflows</button>
        <button className={`tab ${tab === 'history' ? 'active' : ''}`} onClick={() => setTab('history')}>History</button>
      </div>

      {tab === 'recipes' && (
        <div className="grid">
          {rules === null ? (
            <div className="skeleton panel" style={{ height: 120, gridColumn: '1 / -1' }} />
          ) : rules.length === 0 ? (
            <div className="panel empty-state" style={{ gridColumn: '1 / -1', padding: '56px 24px' }}>
              <div className="e-ico" style={{ width: 56, height: 56, fontSize: 26 }}>⟳</div>
              <h4 style={{ fontSize: 16 }}>Create your first automation</h4>
              <p>Recipes fire an action automatically when something happens — a missed call, a completed job, a new review.</p>
            </div>
          ) : (
            rules.map((r) => (
              <div className="panel" key={r.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong>{r.name}</strong>
                  <span className={`chip ${r.enabled ? 'ok' : 'warn'}`} style={{ cursor: 'pointer' }} onClick={() => toggleRule(r.id, !r.enabled)}>
                    {r.enabled ? 'Active' : 'Off'}
                  </span>
                </div>
                <div className="muted" style={{ margin: '8px 0' }}>When <code>{r.triggerEvent}</code></div>
                {(r.actions ?? []).map((a: any, i: number) => (
                  <div className="agent-row" key={i}>
                    <span className="agent-pill">{i + 1}</span>
                    <span>{typeof a === 'string' ? a : a.type}</span>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'workflows' && (
        <div className="panel">
          {flows === null ? (
            <div className="skeleton" style={{ height: 120 }} />
          ) : flows.length === 0 ? (
            <div className="empty-state" style={{ padding: '56px 24px' }}>
              <div className="e-ico" style={{ width: 56, height: 56, fontSize: 26 }}>⇶</div>
              <h4 style={{ fontSize: 16 }}>No workflows yet</h4>
              <p>Build a branching workflow with triggers, conditions, delays and AI steps on the visual canvas.</p>
            </div>
          ) : (
            <table className="t">
              <thead><tr><th>Workflow</th><th>Status</th><th>Version</th></tr></thead>
              <tbody>
                {flows.map((f) => (
                  <tr key={f.id} style={{ cursor: 'pointer' }} onClick={() => { setSelectedFlow(f.id); setTab('history'); }}>
                    <td>{f.name ?? f.id}</td>
                    <td><span className={`chip ${f.published ? 'ok' : 'warn'}`}>{f.published ? 'Published' : 'Draft'}</span></td>
                    <td className="muted">{f.version ?? 1}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'history' && (
        <div className="panel">
          <h3>Runs</h3>
          {!selectedFlow ? (
            <div className="empty-state" style={{ padding: '40px 16px' }}>
              <div className="e-ico">◔</div>
              <h4>No workflow selected</h4>
              <p>Select a workflow to see its execution history.</p>
            </div>
          ) : runs === null ? (
            <div className="skeleton" style={{ height: 100 }} />
          ) : runs.length === 0 ? (
            <div className="empty-state" style={{ padding: '40px 16px' }}>
              <div className="e-ico">◔</div>
              <h4>No runs yet</h4>
              <p>Every execution of this workflow — with its outcome — will appear here.</p>
            </div>
          ) : (
            runs.map((r: any, i: number) => (
              <div className="agent-row" key={r.id ?? i}>
                <span className="agent-pill">{r.startedAt ? new Date(r.startedAt).toLocaleTimeString() : '—'}</span>
                <span style={{ flex: 1 }}>{r.status ?? 'completed'}</span>
              </div>
            ))
          )}
        </div>
      )}
    </>
  );
}
