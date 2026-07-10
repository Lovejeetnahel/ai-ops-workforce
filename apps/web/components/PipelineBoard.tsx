'use client';
import { useEffect, useState } from 'react';
import { api } from '../lib/api';

interface Stage { value: string; label: string; color: string; }
interface Lead { id: string; contact?: { name: string }; serviceType?: string; urgency?: string; location?: string; }

/**
 * The pipeline kanban. Columns come from the business's Industry Module
 * Config (`pipeline`), so the SAME component renders "New Request →
 * Scheduled → Completed" for HVAC and "New Inquiry → Retained → Case Filed"
 * for a law firm. Shows an honest empty state when the API is unreachable
 * or the board has no data yet — never fabricated leads.
 */
export function PipelineBoard() {
  const [stages, setStages] = useState<Stage[]>([]);
  const [board, setBoard] = useState<Record<string, Lead[]>>({});
  const [status, setStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading');

  useEffect(() => {
    (async () => {
      try {
        const config = await api.moduleConfig();
        setStages(config.pipeline.filter((s: any) => !s.hidden));
        const data = await api.board();
        setBoard(Object.fromEntries(data.map((c) => [c.stage, c.leads])));
        setStatus('ready');
      } catch {
        setStatus('unavailable');
      }
    })();
  }, []);

  if (status === 'unavailable') {
    return (
      <div className="empty-state panel">
        <div className="e-ico">▲</div>
        <h4>Pipeline unavailable</h4>
        <p>We couldn&rsquo;t load your pipeline right now. Try refreshing the page.</p>
      </div>
    );
  }

  if (status === 'ready' && stages.every((s) => (board[s.value] ?? []).length === 0)) {
    return (
      <div className="empty-state panel">
        <div className="e-ico">◈</div>
        <h4>No leads yet</h4>
        <p>New leads from calls, forms and referrals will appear here as they come in.</p>
      </div>
    );
  }

  return (
    <div className="board">
      {stages.map((s) => (
        <div className="column" key={s.value}>
          <h3><span className="dot" style={{ background: s.color }} /> {s.label}
            <span className="muted" style={{ marginLeft: 'auto' }}>{(board[s.value] ?? []).length}</span>
          </h3>
          {(board[s.value] ?? []).map((lead) => (
            <div className="card" key={lead.id}>
              <div className="name">{lead.contact?.name ?? 'Unknown'}</div>
              <div className="meta">{lead.serviceType ?? '—'}{lead.location ? ` · ${lead.location}` : ''}</div>
              {lead.urgency === 'EMERGENCY' && <span className="tag" style={{ color: '#fca5a5', borderColor: '#7f1d1d', marginTop: 6 }}>🚨 Emergency</span>}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
