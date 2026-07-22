'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../../lib/api';

/**
 * AI Workforce — the primary management surface for the employee framework
 * (the Voice AI "Agents" tab remains a contextual view of the same data).
 * Everything shown is real: roster + installations, live tasks, durable
 * approvals, decision/usage records. Costs are always labeled as estimates;
 * empty states say plainly when there is no data yet; when the AI provider
 * is not configured the page says so instead of pretending.
 */

type Employee = {
  key: string;
  name: string;
  department: string;
  description: string;
  defaultAuthority: string;
  tools: string[];
  installation?: { enabled: boolean; authority: string; config: Record<string, any> };
};

function fmtCostMicros(v: string | null | undefined): string | null {
  if (v === null || v === undefined) return null;
  const micros = Number(v);
  if (!Number.isFinite(micros)) return null;
  return `$${(micros / 1_000_000).toFixed(4)}`;
}

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

const STATUS_CHIP: Record<string, string> = { DONE: 'ok', RUNNING: 'warn', QUEUED: 'warn', WAITING: 'warn', FAILED: 'err', CANCELLED: 'muted' };
const ACTION_CHIP: Record<string, string> = { EXECUTED: 'ok', PENDING_APPROVAL: 'warn', DENIED: 'err', FAILED: 'err', SKIPPED_DUPLICATE: 'muted' };

export default function AiWorkforcePage() {
  const [aiStatus, setAiStatus] = useState<any>(null);
  const [employees, setEmployees] = useState<Employee[] | null>(null);
  const [approvals, setApprovals] = useState<any[] | null>(null);
  const [tasks, setTasks] = useState<any[] | null>(null);
  const [leaderboard, setLeaderboard] = useState<any[] | null>(null);
  const [usage, setUsage] = useState<any>(null);
  const [selected, setSelected] = useState<Employee | null>(null);

  // Command Center state
  const [command, setCommand] = useState('');
  const [running, setRunning] = useState(false);
  const [run, setRun] = useState<any>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const submitting = useRef(false);

  const refresh = useCallback(() => {
    api.aiStatus().then(setAiStatus).catch(() => setAiStatus(false));
    api.employees().then(setEmployees).catch(() => setEmployees([]));
    api.workforceApprovals().then(setApprovals).catch(() => setApprovals([]));
    api.employeeTasks().then(setTasks).catch(() => setTasks([]));
    api.leaderboard().then(setLeaderboard).catch(() => setLeaderboard([]));
    api.workforceUsage().then(setUsage).catch(() => setUsage(false));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const runCommand = async () => {
    if (submitting.current || !command.trim()) return;
    submitting.current = true;
    setRunning(true);
    setRunError(null);
    setRun(null);
    try {
      const res = await api.runCommand(command.trim());
      setRun(res);
      refresh(); // pick up new tasks/approvals created by the run
    } catch (err) {
      const msg = String((err as Error).message ?? '');
      if (msg.startsWith('429')) setRunError('Too many Command Center runs — wait a minute and try again.');
      else setRunError('The command could not be run. Nothing was executed.');
    } finally {
      submitting.current = false;
      setRunning(false);
    }
  };

  const resolveApproval = async (id: string, action: 'approve' | 'reject') => {
    try {
      if (action === 'approve') await api.approveAction(id);
      else await api.rejectAction(id);
    } catch {
      /* the refresh below shows the authoritative state either way */
    }
    refresh();
  };

  const toggleEmployee = async (e: Employee) => {
    await api.setEmployeeEnabled(e.key, !(e.installation?.enabled ?? true)).catch(() => undefined);
    refresh();
  };

  const statFor = (key: string) => (leaderboard ?? []).find((l: any) => l.agentKey === key || l.key === key);

  return (
    <>
      <div className="topbar">
        <div>
          <h2 style={{ margin: 0 }}>AI Workforce</h2>
          <span className="muted">Your AI employees — real tasks, real approvals, real usage. Nothing simulated.</span>
        </div>
      </div>

      {/* Honest provider state */}
      {aiStatus && aiStatus.state !== 'configured' && (
        <div className={`panel ${aiStatus.state === 'not_configured' ? '' : 'glow'}`} style={{ marginBottom: 16, borderColor: 'rgba(251,191,36,0.4)' }}>
          {aiStatus.state === 'not_configured' ? (
            <span>⚠️ <strong>AI is not configured.</strong> {aiStatus.note ?? 'Set ANTHROPIC_API_KEY to activate reasoning.'} Employees and the Command Center will honestly refuse rather than fake results.</span>
          ) : (
            <span>⚠️ <strong>AI provider issue:</strong> the most recent call failed ({aiStatus.lastError?.kind ?? 'unknown'} at {aiStatus.lastError?.at ? new Date(aiStatus.lastError.at).toLocaleTimeString() : '—'}). Runs may fail until it recovers.</span>
          )}
        </div>
      )}

      {/* Command Center */}
      <div className="panel glow" style={{ marginBottom: 16 }}>
        <h3>Command Center</h3>
        <p className="muted" style={{ marginTop: 0 }}>
          Tell your workforce what you need — e.g. “Show today’s priorities” or “List invoices overdue more than 30 days and draft reminders.”
          Actions with outside impact (messages, documents, payments) queue for your approval before anything is sent.
        </p>
        <div className="cc-input-row">
          <textarea
            className="cc-textarea"
            rows={2}
            maxLength={2000}
            placeholder="What should your AI workforce do?"
            value={command}
            disabled={running}
            onChange={(e) => setCommand(e.target.value)}
          />
          <button className="btn" onClick={runCommand} disabled={running || !command.trim()}>
            {running ? 'Running…' : 'Run'}
          </button>
        </div>
        {runError && <div className="chip err" role="alert" style={{ marginTop: 10 }}>{runError}</div>}
        {run && (
          <div className="card" style={{ marginTop: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <span className="name">Run result</span>
              {run.runId && <span className="chip muted">ref: {run.runId}</span>}
            </div>
            <div className="meta" style={{ marginTop: 6 }}>Requested: {run.output?.requested ?? '—'}</div>
            <p style={{ whiteSpace: 'pre-wrap', fontSize: 13.5, margin: '10px 0' }}>{run.output?.response ?? run.summary}</p>
            {Array.isArray(run.output?.actions) && run.output.actions.length > 0 ? (
              <div className="t-wrap">
                <table className="t">
                  <thead><tr><th>Action</th><th>Status</th><th>Detail</th></tr></thead>
                  <tbody>
                    {run.output.actions.map((a: any, i: number) => (
                      <tr key={i}>
                        <td>{a.tool}</td>
                        <td><span className={`chip ${ACTION_CHIP[a.status] ?? 'muted'}`}>{a.status.replaceAll('_', ' ').toLowerCase()}</span></td>
                        <td className="muted">{a.detail ?? (a.approvalId ? 'see Pending approvals below' : '—')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="meta">No actions were taken in this run.</div>
            )}
          </div>
        )}
      </div>

      {/* Pending approvals */}
      <div className="panel" style={{ marginBottom: 16 }}>
        <h3>Pending approvals {approvals && approvals.length > 0 && <span className="chip warn">{approvals.length}</span>}</h3>
        {approvals === null ? (
          <div className="meta">Loading…</div>
        ) : approvals.length === 0 ? (
          <div className="meta">Nothing waiting on you. When an AI employee proposes an action with outside impact (a message, a document, a payment link), it appears here first.</div>
        ) : (
          <div className="t-wrap">
            <table className="t">
              <thead><tr><th>Employee</th><th>Action</th><th>Why</th><th>Expires</th><th></th></tr></thead>
              <tbody>
                {approvals.map((a) => (
                  <tr key={a.id}>
                    <td>{a.agentKey}</td>
                    <td><span className="chip warn">{a.toolName}</span><div className="meta" style={{ maxWidth: 320, overflowWrap: 'anywhere' }}>{JSON.stringify(a.toolArgs).slice(0, 160)}</div></td>
                    <td className="muted" style={{ maxWidth: 260 }}>{a.reason ?? '—'}</td>
                    <td className="muted">{new Date(a.expiresAt).toLocaleDateString()}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button className="btn sm" onClick={() => resolveApproval(a.id, 'approve')}>Approve</button>{' '}
                      <button className="btn ghost sm" onClick={() => resolveApproval(a.id, 'reject')}>Reject</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Employees */}
      <div className="panel" style={{ marginBottom: 16 }}>
        <h3>Employees</h3>
        {employees === null ? (
          <div className="meta">Loading…</div>
        ) : (
          <div className="grid">
            {employees.map((e) => {
              const stat = statFor(e.key);
              const enabled = e.installation?.enabled ?? true;
              return (
                <div className="card" key={e.key}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <span className="name">{e.name}</span>
                    <span className={`chip ${enabled ? 'ok' : 'muted'}`}>{enabled ? 'Active' : 'Off'}</span>
                  </div>
                  <div className="meta">{e.department} · authority: {(e.installation?.authority ?? e.defaultAuthority).toLowerCase()}</div>
                  <div className="meta" style={{ margin: '6px 0' }}>{e.description}</div>
                  {stat && (stat.tasksCompleted ?? 0) + (stat.tasksFailed ?? 0) > 0 ? (
                    <div className="meta">Success rate: {Math.round((stat.successRate ?? 0) * 100)}% · {stat.tasksCompleted ?? 0} done{(stat.tasksFailed ?? 0) > 0 ? ` · ${stat.tasksFailed} failed` : ''}</div>
                  ) : (
                    <div className="meta">No completed tasks yet — no stats to show.</div>
                  )}
                  <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button className="btn ghost sm" onClick={() => setSelected(selected?.key === e.key ? null : e)}>{selected?.key === e.key ? 'Close' : 'Configure'}</button>
                    <button className="btn ghost sm" onClick={() => toggleEmployee(e)}>{enabled ? 'Turn off' : 'Turn on'}</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {selected && <EmployeeConfigEditor employee={selected} onSaved={() => { setSelected(null); refresh(); }} onCancel={() => setSelected(null)} />}
      </div>

      {/* Recent activity */}
      <div className="grid-2" style={{ marginBottom: 16 }}>
        <div className="panel">
          <h3>Recent tasks</h3>
          {tasks === null ? (
            <div className="meta">Loading…</div>
          ) : tasks.length === 0 ? (
            <div className="meta">No AI tasks have run yet. They appear here as employees respond to events, schedules, or your commands.</div>
          ) : (
            <div className="t-wrap">
              <table className="t">
                <thead><tr><th>Employee</th><th>Task</th><th>Status</th><th>Tokens</th><th>When</th></tr></thead>
                <tbody>
                  {tasks.slice(0, 25).map((t) => (
                    <tr key={t.id}>
                      <td>{t.agentKey}</td>
                      <td className="muted" style={{ maxWidth: 220, overflowWrap: 'anywhere' }}>{t.type}{t.reason ? ` — ${String(t.reason).slice(0, 60)}` : ''}</td>
                      <td><span className={`chip ${STATUS_CHIP[t.status] ?? 'muted'}`}>{t.status.toLowerCase()}</span>{t.error && <div className="meta" style={{ maxWidth: 200 }}>{String(t.error).slice(0, 80)}</div>}</td>
                      <td className="muted">{t.tokensIn || t.tokensOut ? `${t.tokensIn ?? 0}↑ ${t.tokensOut ?? 0}↓` : '—'}</td>
                      <td className="muted" style={{ whiteSpace: 'nowrap' }}>{timeAgo(t.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="panel">
          <h3>AI usage (last 30 days)</h3>
          {usage === null ? (
            <div className="meta">Loading…</div>
          ) : usage === false ? (
            <div className="meta">Usage data unavailable.</div>
          ) : Object.keys(usage.byAgent ?? {}).length === 0 ? (
            <div className="meta">No AI calls recorded yet. Once employees start reasoning, exact token usage per employee and model appears here.</div>
          ) : (
            <>
              {!usage.pricingConfigured && <div className="meta" style={{ marginBottom: 8 }}>Cost estimates are off (no pricing configured) — token counts below are exact.</div>}
              <div className="t-wrap">
                <table className="t">
                  <thead><tr><th>Employee</th><th>Calls</th><th>Tokens in/out</th><th>Est. cost</th></tr></thead>
                  <tbody>
                    {Object.entries(usage.byAgent).map(([agent, u]: [string, any]) => (
                      <tr key={agent}>
                        <td>{agent}</td>
                        <td className="muted">{u.calls}</td>
                        <td className="muted">{u.tokensIn.toLocaleString()} / {u.tokensOut.toLocaleString()}</td>
                        <td className="muted">{fmtCostMicros(u.costMicros) ?? '—'}{u.costMicros ? ' (est.)' : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

function EmployeeConfigEditor({ employee, onSaved, onCancel }: { employee: Employee; onSaved: () => void; onCancel: () => void }) {
  const cfg = employee.installation?.config ?? {};
  const [personality, setPersonality] = useState<string>(cfg.personality ?? '');
  const [instructions, setInstructions] = useState<string>(cfg.instructions ?? '');
  const [goal, setGoal] = useState<string>(cfg.goal ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.patchEmployeeConfig(employee.key, {
        personality: personality || undefined,
        instructions: instructions || undefined,
        goal: goal || undefined,
      });
      onSaved();
    } catch {
      setError('Could not save — check field lengths and try again.');
      setSaving(false);
    }
  };

  return (
    <div className="card" style={{ marginTop: 14 }}>
      <div className="name">Configure {employee.name}</div>
      <div className="meta" style={{ marginBottom: 10 }}>Shapes how this employee reasons and writes. Applied on its next task.</div>
      <div className="field">
        <label htmlFor="cfg-personality">Personality (max 2000 chars)</label>
        <textarea id="cfg-personality" className="cc-textarea" rows={2} maxLength={2000} value={personality} onChange={(e) => setPersonality(e.target.value)} placeholder="e.g. Warm, brief, always plain language — never jargon." />
      </div>
      <div className="field">
        <label htmlFor="cfg-goal">Goal (max 1000 chars)</label>
        <textarea id="cfg-goal" className="cc-textarea" rows={1} maxLength={1000} value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="e.g. Book more repeat service visits." />
      </div>
      <div className="field">
        <label htmlFor="cfg-instructions">Standing instructions (max 4000 chars)</label>
        <textarea id="cfg-instructions" className="cc-textarea" rows={3} maxLength={4000} value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="e.g. Never offer discounts above 10%. Always mention our 24/7 line." />
      </div>
      {error && <div className="chip err" role="alert" style={{ marginBottom: 8 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn sm" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
        <button className="btn ghost sm" onClick={onCancel} disabled={saving}>Cancel</button>
      </div>
    </div>
  );
}
