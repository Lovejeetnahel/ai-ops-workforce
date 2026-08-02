'use client';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../../../lib/api';
import { Modal } from '../../../../components/Modal';
import { useToast } from '../../../../components/Toast';

const TABS = ['Appointments', 'Services', 'Booking links'] as const;
type Tab = (typeof TABS)[number];
const STATUS_CHIP: Record<string, string> = { REQUESTED: 'warn', CONFIRMED: 'ok', RESCHEDULED: 'warn', CANCELLED: 'err', NO_SHOW: 'err', COMPLETED: 'ok' };

/**
 * Appointments V1 — the APPOINTMENT core on the existing scheduling engine:
 * real bookings, bookable services, public self-booking links, reschedule/
 * cancel/no-show, and live stats. No second calendar engine.
 */
export default function AppointmentsPage() {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('Appointments');
  const [stats, setStats] = useState<any>(null);
  const [items, setItems] = useState<any[] | null>(null);
  const [services, setServices] = useState<any[] | null>(null);
  const [links, setLinks] = useState<any[] | null>(null);
  const [svcOpen, setSvcOpen] = useState(false);
  const [svc, setSvc] = useState({ name: '', durationMin: '60', priceCents: '' });
  const [linkOpen, setLinkOpen] = useState(false);
  const [nl, setNl] = useState({ name: '', serviceId: '' });
  const [reschedFor, setReschedFor] = useState<any>(null);
  const [reschedAt, setReschedAt] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api.appointmentStats().then(setStats).catch(() => setStats(false));
    api.appointments().then(setItems).catch(() => setItems([]));
    api.offerings().then(setServices).catch(() => setServices([]));
    api.bookingLinks().then(setLinks).catch(() => setLinks([]));
  }, []);
  useEffect(() => { load(); }, [load]);

  const createService = async () => {
    setBusy(true);
    try {
      await api.createOffering({ name: svc.name.trim(), durationMin: Number(svc.durationMin) || 60, priceCents: svc.priceCents ? Math.round(Number(svc.priceCents) * 100) : undefined });
      setSvcOpen(false); setSvc({ name: '', durationMin: '60', priceCents: '' }); load();
      toast.success('Service added');
    } catch { toast.error('Could not add the service'); }
    finally { setBusy(false); }
  };

  const createLink = async () => {
    setBusy(true);
    try {
      const link = await api.createBookingLink({ name: nl.name.trim(), serviceId: nl.serviceId || undefined });
      setLinkOpen(false); setNl({ name: '', serviceId: '' }); load();
      toast.success('Booking link created', `/book/${link.slug}`);
    } catch { toast.error('Could not create the link'); }
    finally { setBusy(false); }
  };

  const setStatus = async (id: string, status: string) => {
    try { await api.setAppointmentStatus(id, status); load(); toast.success(`Marked ${status.toLowerCase().replace('_', '-')}`); }
    catch (e: any) { toast.error('Could not update', String(e?.message ?? '').slice(0, 160)); }
  };

  const reschedule = async () => {
    if (!reschedFor || !reschedAt) return;
    setBusy(true);
    try {
      await api.rescheduleAppointment(reschedFor.id, new Date(reschedAt).toISOString());
      setReschedFor(null); load(); toast.success('Rescheduled');
    } catch (e: any) { toast.error('Could not reschedule', String(e?.message ?? '').replace(/^\d+\s*/, '').slice(0, 200)); }
    finally { setBusy(false); }
  };

  return (
    <>
      <div className="topbar">
        <div>
          <h2 style={{ margin: 0 }}>Appointments</h2>
          <span className="muted">Scheduling on your real availability — bookings, services and self-booking links</span>
        </div>
      </div>

      {stats && stats !== false && (
        <div className="grid-kpi" style={{ marginBottom: 16 }}>
          <div className="panel"><div className="muted">Next 7 days</div><div className="kpi">{stats.upcoming7d}</div></div>
          <div className="panel"><div className="muted">Awaiting confirmation</div><div className="kpi">{stats.awaitingConfirmation}</div></div>
          <div className="panel"><div className="muted">Completed (30d)</div><div className="kpi">{stats.completed30d}</div></div>
          <div className="panel"><div className="muted">No-shows (30d)</div><div className="kpi">{stats.noShows30d}</div></div>
        </div>
      )}

      <div className="tabs">
        {TABS.map((t) => <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>{t}</button>)}
      </div>

      {tab === 'Appointments' && (
        items === null ? <div className="panel"><div className="skeleton" style={{ height: 140 }} /></div> :
        items.length === 0 ? (
          <div className="panel empty-state" style={{ padding: '48px 24px' }}>
            <div className="e-ico">◈</div><h4>No appointments yet</h4>
            <p>Bookings from your team, the customer portal, your website and self-booking links all land here.</p>
          </div>
        ) : (
          <div className="panel" style={{ overflowX: 'auto' }}>
            <table className="t">
              <thead><tr><th>When</th><th>Customer</th><th>Staff</th><th>Status</th><th>Notes</th><th /></tr></thead>
              <tbody>
                {items.map((b) => (
                  <tr key={b.id}>
                    <td className="muted" style={{ whiteSpace: 'nowrap' }}>{new Date(b.start).toLocaleString()}</td>
                    <td>{b.contact?.name ?? '—'}<span className="muted" style={{ display: 'block', fontSize: 11 }}>{b.contact?.phone ?? b.contact?.email ?? ''}</span></td>
                    <td className="muted">{b.assignedTo?.name ?? 'Unassigned'}</td>
                    <td><span className={`chip ${STATUS_CHIP[b.status] ?? 'warn'}`}>{b.status}</span></td>
                    <td className="muted" style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.notes ?? '—'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {b.status === 'REQUESTED' && <button className="btn ghost sm" onClick={() => setStatus(b.id, 'CONFIRMED')}>Confirm</button>}
                      {['REQUESTED', 'CONFIRMED', 'RESCHEDULED'].includes(b.status) && (
                        <>
                          <button className="btn ghost sm" onClick={() => { setReschedFor(b); setReschedAt(''); }}>Reschedule</button>
                          <button className="btn ghost sm" onClick={() => setStatus(b.id, 'CANCELLED')}>Cancel</button>
                          {new Date(b.start) < new Date() && <button className="btn ghost sm" onClick={() => setStatus(b.id, 'NO_SHOW')}>No-show</button>}
                          {new Date(b.start) < new Date() && <button className="btn ghost sm" onClick={() => setStatus(b.id, 'COMPLETED')}>Complete</button>}
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {tab === 'Services' && (
        <div className="panel">
          <div className="topbar" style={{ marginBottom: 10 }}>
            <h3 style={{ margin: 0 }}>Bookable services</h3>
            <button className="btn sm" onClick={() => setSvcOpen(true)}>+ Add service</button>
          </div>
          {services === null ? <div className="skeleton" style={{ height: 80 }} /> :
          services.length === 0 ? <p className="muted" style={{ fontSize: 13 }}>Define what customers can book — name, duration and an optional display price.</p> : (
            services.map((s) => (
              <div className="agent-row" key={s.id}>
                <span style={{ flex: 1 }}><strong>{s.name}</strong><span className="muted" style={{ marginLeft: 8, fontSize: 12 }}>{s.durationMin} min{s.priceCents != null ? ` · $${(s.priceCents / 100).toFixed(0)}` : ''}</span></span>
                <button className="btn ghost sm" onClick={async () => { await api.updateOffering(s.id, { active: !s.active }).catch(() => {}); load(); }}>
                  {s.active ? 'Active' : 'Inactive'}
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'Booking links' && (
        <div className="panel">
          <div className="topbar" style={{ marginBottom: 10 }}>
            <h3 style={{ margin: 0 }}>Self-booking links</h3>
            <button className="btn sm" onClick={() => setLinkOpen(true)}>+ New link</button>
          </div>
          {links === null ? <div className="skeleton" style={{ height: 80 }} /> :
          links.length === 0 ? (
            <p className="muted" style={{ fontSize: 13 }}>Share a link where customers pick a real free slot from your calendar. Bookings arrive as &ldquo;requested&rdquo; for you to confirm.</p>
          ) : (
            links.map((l) => (
              <div className="agent-row" key={l.id}>
                <span style={{ flex: 1 }}>
                  <strong>{l.name}</strong>{l.service && <span className="muted" style={{ marginLeft: 6, fontSize: 12 }}>{l.service.name}</span>}
                  <span className="muted" style={{ display: 'block', fontSize: 11 }}>sofilic.com/book/{l.slug}</span>
                </span>
                <button className="btn ghost sm" onClick={async () => { await navigator.clipboard.writeText(`https://sofilic.com/book/${l.slug}`); toast.success('Link copied'); }}>Copy</button>
                <button className="btn ghost sm" onClick={async () => { await api.toggleBookingLink(l.id, !l.active).catch(() => {}); load(); }}>{l.active ? 'Active' : 'Off'}</button>
              </div>
            ))
          )}
        </div>
      )}

      <Modal open={svcOpen} onClose={() => setSvcOpen(false)} title="Add a bookable service">
        <div className="field"><label>Name</label><input value={svc.name} onChange={(e) => setSvc({ ...svc, name: e.target.value })} placeholder="Furnace tune-up" /></div>
        <div className="grid-2">
          <div className="field"><label>Duration (minutes)</label><input type="number" value={svc.durationMin} onChange={(e) => setSvc({ ...svc, durationMin: e.target.value })} /></div>
          <div className="field"><label>Display price ($, optional)</label><input type="number" value={svc.priceCents} onChange={(e) => setSvc({ ...svc, priceCents: e.target.value })} /></div>
        </div>
        <div className="modal-actions">
          <button className="btn ghost sm" onClick={() => setSvcOpen(false)}>Cancel</button>
          <button className="btn sm" disabled={busy || !svc.name.trim()} onClick={createService}>{busy ? 'Saving…' : 'Add service'}</button>
        </div>
      </Modal>

      <Modal open={linkOpen} onClose={() => setLinkOpen(false)} title="New self-booking link">
        <div className="field"><label>Name</label><input value={nl.name} onChange={(e) => setNl({ ...nl, name: e.target.value })} placeholder="Book a tune-up" /></div>
        <div className="field"><label>Service (optional)</label>
          <select value={nl.serviceId} onChange={(e) => setNl({ ...nl, serviceId: e.target.value })}>
            <option value="">Any (60 min default)</option>
            {(services ?? []).filter((s) => s.active).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select></div>
        <div className="modal-actions">
          <button className="btn ghost sm" onClick={() => setLinkOpen(false)}>Cancel</button>
          <button className="btn sm" disabled={busy || !nl.name.trim()} onClick={createLink}>{busy ? 'Creating…' : 'Create link'}</button>
        </div>
      </Modal>

      <Modal open={!!reschedFor} onClose={() => setReschedFor(null)} title="Reschedule appointment">
        <div className="field"><label>New start time (checked against the staff member&rsquo;s real availability)</label>
          <input type="datetime-local" value={reschedAt} onChange={(e) => setReschedAt(e.target.value)} /></div>
        <div className="modal-actions">
          <button className="btn ghost sm" onClick={() => setReschedFor(null)}>Cancel</button>
          <button className="btn sm" disabled={busy || !reschedAt} onClick={reschedule}>{busy ? 'Moving…' : 'Reschedule'}</button>
        </div>
      </Modal>
    </>
  );
}
