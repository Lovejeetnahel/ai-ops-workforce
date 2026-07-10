'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '../../../../lib/api';

export default function FieldOperationsPage() {
  const [jobs, setJobs] = useState<any[] | null>(null);

  useEffect(() => {
    api.jobs().then((j) => setJobs(j ?? [])).catch(() => setJobs([]));
  }, []);

  const setStatus = async (id: string, status: string) => {
    try {
      await api.updateJobStatus(id, status);
      setJobs((prev) => prev!.map((j) => (j.id === id ? { ...j, status } : j)));
    } catch {}
  };

  return (
    <>
      <div className="topbar">
        <div>
          <h2 style={{ margin: 0 }}>Field Operations</h2>
          <span className="muted">Jobs, dispatch and field team status</span>
        </div>
        <Link href="/apps" className="btn ghost sm">← Apps</Link>
      </div>

      <div className="panel">
        <h3>Jobs</h3>
        {jobs === null ? (
          <div className="skeleton" style={{ height: 140 }} />
        ) : jobs.length === 0 ? (
          <div className="empty-state">
            <div className="e-ico">▣</div>
            <h4>No jobs yet</h4>
            <p>Jobs created from booked leads will show up here, ready to dispatch.</p>
          </div>
        ) : (
          <table className="t">
            <thead><tr><th>Job</th><th>Status</th><th>Assigned to</th><th></th></tr></thead>
            <tbody>
              {jobs.map((j: any) => (
                <tr key={j.id}>
                  <td>{j.title ?? j.id.slice(0, 8)}</td>
                  <td><span className="chip warn">{j.status}</span></td>
                  <td className="muted">{j.assignedTo?.name ?? 'Unassigned'}</td>
                  <td style={{ textAlign: 'right' }}>
                    {j.status !== 'COMPLETED' && (
                      <button className="btn ghost sm" onClick={() => setStatus(j.id, 'COMPLETED')}>Mark complete</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="grid-2" style={{ marginTop: 16 }}>
        <div className="panel">
          <h3>Dispatch queue</h3>
          <div className="empty-state" style={{ padding: '28px 16px' }}>
            <div className="e-ico">➤</div>
            <h4>Nothing waiting on dispatch</h4>
            <p>Unscheduled jobs will appear here for assignment.</p>
          </div>
        </div>
        <div className="panel">
          <h3>Field team status</h3>
          <div className="empty-state" style={{ padding: '28px 16px' }}>
            <div className="e-ico">▤</div>
            <h4>No one clocked in</h4>
            <p>Live status from the field team app will appear here.</p>
          </div>
        </div>
      </div>
    </>
  );
}
