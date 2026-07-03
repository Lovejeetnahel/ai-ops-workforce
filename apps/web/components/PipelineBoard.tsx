'use client';
import { useEffect, useState } from 'react';
import { api } from '../lib/api';

interface Stage { value: string; label: string; color: string; }
interface Lead { id: string; contact?: { name: string }; serviceType?: string; urgency?: string; location?: string; }

/**
 * The pipeline kanban. Columns come from the tenant's Industry Module Config
 * (`pipeline`), so the SAME component renders "New Request → Scheduled → Completed"
 * for HVAC and "New Inquiry → Retained → Case Filed" for an immigration firm.
 * Falls back to demo data when the API isn't reachable so the shell always renders.
 */
export function PipelineBoard() {
  const [stages, setStages] = useState<Stage[]>([]);
  const [board, setBoard] = useState<Record<string, Lead[]>>({});

  useEffect(() => {
    (async () => {
      try {
        const config = await api.moduleConfig();
        setStages(config.pipeline.filter((s: any) => !s.hidden));
        const data = await api.board();
        setBoard(Object.fromEntries(data.map((c) => [c.stage, c.leads])));
      } catch {
        // Offline demo fallback.
        setStages([
          { value: 'NEW', label: 'New Request', color: '#3b82f6' },
          { value: 'CONTACTED', label: 'Contacted', color: '#8b5cf6' },
          { value: 'QUALIFIED', label: 'Quoted', color: '#f59e0b' },
          { value: 'BOOKED', label: 'Scheduled', color: '#10b981' },
          { value: 'COMPLETED', label: 'Completed', color: '#22c55e' },
        ]);
        setBoard({
          NEW: [{ id: '1', contact: { name: 'Jordan M.' }, serviceType: 'No A/C', urgency: 'EMERGENCY', location: 'Eastside' }],
          CONTACTED: [{ id: '2', contact: { name: 'Priya K.' }, serviceType: 'Water heater', location: 'Downtown' }],
          BOOKED: [{ id: '3', contact: { name: 'Sam R.' }, serviceType: 'Furnace tune-up', location: 'Westside' }],
        });
      }
    })();
  }, []);

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
