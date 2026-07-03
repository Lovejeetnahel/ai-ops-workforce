'use client';
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';

const FALLBACK = [
  { key: 'sales', name: 'Sales AI', department: 'Sales', installation: { enabled: true, authority: 'AUTONOMOUS' } },
  { key: 'customer_success', name: 'Customer Success AI', department: 'Customer Success', installation: { enabled: true, authority: 'AUTONOMOUS' } },
  { key: 'collections', name: 'Collections AI', department: 'Finance', installation: { enabled: true, authority: 'AUTONOMOUS' } },
  { key: 'recruiting', name: 'Recruiting AI', department: 'People', installation: { enabled: true, authority: 'APPROVE' } },
  { key: 'operations_manager', name: 'Operations Manager AI', department: 'Operations', installation: { enabled: true, authority: 'APPROVE' } },
  { key: 'marketing', name: 'Marketing AI', department: 'Marketing', installation: { enabled: true, authority: 'APPROVE' } },
  { key: 'receptionist', name: 'AI Receptionist', department: 'Front Office', installation: { enabled: true, authority: 'AUTONOMOUS' } },
  { key: 'executive', name: 'Executive AI', department: 'Leadership', installation: { enabled: true, authority: 'AUTONOMOUS' } },
];

export default function WorkforcePage() {
  const [employees, setEmployees] = useState<any[]>(FALLBACK);
  const [board, setBoard] = useState<any[]>([]);

  useEffect(() => {
    api.employees().then((e) => setEmployees(e?.length ? e : FALLBACK)).catch(() => {});
    api.leaderboard().then(setBoard).catch(() => {});
  }, []);

  return (
    <>
      <div className="topbar">
        <div><h2 style={{ margin: 0 }}>AI Workforce</h2><span className="muted">Your installable AI employees</span></div>
        <span className="badge">8 employees</span>
      </div>
      <div className="grid">
        {employees.map((e) => (
          <div className="panel" key={e.key}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong>{e.name}</strong>
              <span className="tag" style={{ color: e.installation?.enabled ? '#34d399' : '#94a3b8' }}>{e.installation?.enabled ? 'Active' : 'Off'}</span>
            </div>
            <div className="muted" style={{ margin: '6px 0' }}>{e.department}</div>
            <span className="agent-pill">{e.installation?.authority ?? 'AUTONOMOUS'}</span>
          </div>
        ))}
      </div>
      {board.length > 0 && (
        <div className="panel" style={{ marginTop: 18 }}>
          <h3>Leaderboard (ROI)</h3>
          <table className="t">
            <thead><tr><th>Agent</th><th>Tasks</th><th>Revenue</th><th>Net</th><th>Success</th></tr></thead>
            <tbody>
              {board.map((r) => (
                <tr key={r.agentKey}><td>{r.agentKey}</td><td>{r.tasksCompleted}</td><td>${r.revenueGenerated}</td><td>${r.netValue}</td><td>{r.successRate}%</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
