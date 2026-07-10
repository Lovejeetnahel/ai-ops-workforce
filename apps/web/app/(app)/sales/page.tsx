'use client';
import { useEffect, useState } from 'react';
import { PipelineBoard } from '../../../components/PipelineBoard';
import { api } from '../../../lib/api';

export default function SalesPage() {
  const [tasks, setTasks] = useState<any[] | null>(null);

  useEffect(() => {
    api.tasks().then(setTasks).catch(() => setTasks([]));
  }, []);

  return (
    <>
      <div className="topbar">
        <div>
          <h2 style={{ margin: 0 }}>Sales</h2>
          <span className="muted">Your pipeline, opportunities and follow-ups</span>
        </div>
        <span className="badge">Live pipeline</span>
      </div>

      <PipelineBoard />

      <div className="panel" style={{ marginTop: 20 }}>
        <h3>Follow-ups</h3>
        {tasks === null ? (
          <div className="skeleton" style={{ height: 80 }} />
        ) : tasks.length === 0 ? (
          <div className="empty-state" style={{ padding: '28px 16px' }}>
            <div className="e-ico">✓</div>
            <h4>No follow-ups due</h4>
            <p>Tasks tied to your opportunities will show up here.</p>
          </div>
        ) : (
          tasks.map((t) => (
            <div className="agent-row" key={t.id}>
              <span style={{ flex: 1 }}>{t.title}</span>
              {t.dueAt && <span className="muted">{new Date(t.dueAt).toLocaleDateString()}</span>}
            </div>
          ))
        )}
      </div>
    </>
  );
}
