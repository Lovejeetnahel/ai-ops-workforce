'use client';
import { useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import { Modal } from '../../../components/Modal';
import { useToast } from '../../../components/Toast';

type Tab = 'contacts' | 'companies' | 'tasks';

export default function CrmPage() {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('contacts');
  const [q, setQ] = useState('');
  const [contacts, setContacts] = useState<any[] | null>(null);
  const [companies, setCompanies] = useState<any[] | null>(null);
  const [tasks, setTasks] = useState<any[] | null>(null);
  const [newCompanyOpen, setNewCompanyOpen] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [saving, setSaving] = useState(false);

  const loadContacts = () => {
    api
      .board()
      .then((cols) => {
        const seen = new Map<string, any>();
        cols.forEach((c) => c.leads.forEach((l: any) => {
          const name = l.contact?.name;
          if (name && !seen.has(name)) seen.set(name, l);
        }));
        setContacts(Array.from(seen.values()));
      })
      .catch(() => setContacts([]));
  };
  const loadCompanies = () => api.companies(q).then(setCompanies).catch(() => setCompanies([]));
  const loadTasks = () => api.tasks().then(setTasks).catch(() => setTasks([]));

  useEffect(() => { loadContacts(); loadCompanies(); loadTasks(); }, []);
  useEffect(() => { if (tab === 'companies') loadCompanies(); }, [q]);

  const createCompany = async () => {
    if (!companyName.trim()) return;
    setSaving(true);
    try {
      await api.createCompany({ name: companyName.trim() });
      toast.success('Company added', companyName);
      setCompanyName('');
      setNewCompanyOpen(false);
      loadCompanies();
    } catch {
      toast.error('Could not add company');
    } finally {
      setSaving(false);
    }
  };

  const completeTask = async (id: string) => {
    try {
      await api.completeTask(id);
      toast.success('Task completed');
      loadTasks();
    } catch {
      toast.error('Could not complete task');
    }
  };

  return (
    <>
      <div className="topbar">
        <div>
          <h2 style={{ margin: 0 }}>CRM</h2>
          <span className="muted">Contacts, companies and follow-ups in one place</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="search-trigger" style={{ minWidth: 220 }}>
            🔎
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search companies…"
              style={{ background: 'none', border: 0, outline: 'none', color: 'var(--text)', fontSize: 13, width: '100%' }}
            />
          </div>
          <button className="btn sm" onClick={() => setNewCompanyOpen(true)}>+ Add company</button>
        </div>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === 'contacts' ? 'active' : ''}`} onClick={() => setTab('contacts')}>Contacts</button>
        <button className={`tab ${tab === 'companies' ? 'active' : ''}`} onClick={() => setTab('companies')}>Companies</button>
        <button className={`tab ${tab === 'tasks' ? 'active' : ''}`} onClick={() => setTab('tasks')}>Tasks</button>
      </div>

      {tab === 'contacts' && (
        <div className="panel">
          {contacts === null ? (
            <div className="skeleton" style={{ height: 140 }} />
          ) : contacts.length === 0 ? (
            <div className="empty-state">
              <div className="e-ico">◈</div>
              <h4>No contacts yet</h4>
              <p>Contacts appear automatically as leads come in from calls, forms and referrals.</p>
            </div>
          ) : (
            <table className="t">
              <thead><tr><th>Name</th><th>Service</th><th>Location</th><th>Status</th></tr></thead>
              <tbody>
                {contacts.map((c) => (
                  <tr key={c.id}>
                    <td>{c.contact?.name ?? 'Unknown'}</td>
                    <td className="muted">{c.serviceType ?? '—'}</td>
                    <td className="muted">{c.location ?? '—'}</td>
                    <td>{c.urgency === 'EMERGENCY' ? <span className="chip err">Urgent</span> : <span className="chip ok">Active</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'companies' && (
        <div className="panel">
          {companies === null ? (
            <div className="skeleton" style={{ height: 140 }} />
          ) : companies.length === 0 ? (
            <div className="empty-state">
              <div className="e-ico">▣</div>
              <h4>No companies yet</h4>
              <p>Add the businesses you work with — vendors, partners, or B2B customers.</p>
              <button className="btn sm" onClick={() => setNewCompanyOpen(true)}>+ Add company</button>
            </div>
          ) : (
            <table className="t">
              <thead><tr><th>Company</th><th>Domain</th><th>Phone</th><th>Tags</th></tr></thead>
              <tbody>
                {companies.map((c) => (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    <td className="muted">{c.domain ?? '—'}</td>
                    <td className="muted">{c.phone ?? '—'}</td>
                    <td>{(c.tags ?? []).map((t: string) => <span key={t} className="tag" style={{ marginRight: 4 }}>{t}</span>)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'tasks' && (
        <div className="panel">
          {tasks === null ? (
            <div className="skeleton" style={{ height: 140 }} />
          ) : tasks.length === 0 ? (
            <div className="empty-state">
              <div className="e-ico">✓</div>
              <h4>No open tasks</h4>
              <p>Follow-ups and to-dos you create across contacts, companies and leads show up here.</p>
            </div>
          ) : (
            tasks.map((t) => (
              <div className="agent-row" key={t.id}>
                <span style={{ flex: 1 }}><strong>{t.title}</strong>{t.body && <span className="muted"> — {t.body}</span>}</span>
                {t.dueAt && <span className="muted">{new Date(t.dueAt).toLocaleDateString()}</span>}
                <button className="btn ghost sm" onClick={() => completeTask(t.id)}>Complete</button>
              </div>
            ))
          )}
        </div>
      )}

      <Modal open={newCompanyOpen} onClose={() => setNewCompanyOpen(false)} title="Add a company">
        <div className="field">
          <label htmlFor="cname">Company name</label>
          <input id="cname" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Acme Supply Co." />
        </div>
        <div className="modal-actions">
          <button className="btn ghost sm" onClick={() => setNewCompanyOpen(false)}>Cancel</button>
          <button className="btn sm" disabled={saving || !companyName.trim()} onClick={createCompany}>
            {saving ? 'Saving…' : 'Add company'}
          </button>
        </div>
      </Modal>
    </>
  );
}
