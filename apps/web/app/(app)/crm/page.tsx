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
  const [newContactOpen, setNewContactOpen] = useState(false);
  const [ncName, setNcName] = useState('');
  const [ncPhone, setNcPhone] = useState('');
  const [ncEmail, setNcEmail] = useState('');
  const [contactDetail, setContactDetail] = useState<any>(null);

  const createContact = async () => {
    if (!ncName.trim()) return;
    setSaving(true);
    try {
      await api.createContact({ name: ncName.trim(), phone: ncPhone || undefined, email: ncEmail || undefined });
      toast.success('Contact added', ncName);
      setNcName(''); setNcPhone(''); setNcEmail(''); setNewContactOpen(false);
      loadContacts();
    } catch {
      toast.error('Could not add contact');
    } finally {
      setSaving(false);
    }
  };

  const openContact = async (id: string) => {
    try { setContactDetail(await api.contact(id)); } catch { toast.error('Could not load the contact'); }
  };

  // Sprint 2: real first-class contacts API (was derived from the leads board).
  const loadContacts = () => api.contacts(q || undefined).then(setContacts).catch(() => setContacts([]));
  const loadCompanies = () => api.companies(q).then(setCompanies).catch(() => setCompanies([]));
  const loadTasks = () => api.tasks().then(setTasks).catch(() => setTasks([]));

  useEffect(() => { loadContacts(); loadCompanies(); loadTasks(); }, []);
  useEffect(() => { if (tab === 'companies') loadCompanies(); if (tab === 'contacts') loadContacts(); }, [q]);

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
              placeholder={tab === 'contacts' ? 'Search contacts…' : 'Search companies…'}
              style={{ background: 'none', border: 0, outline: 'none', color: 'var(--text)', fontSize: 13, width: '100%' }}
            />
          </div>
          {tab === 'contacts'
            ? <button className="btn sm" onClick={() => setNewContactOpen(true)}>+ Add contact</button>
            : <button className="btn sm" onClick={() => setNewCompanyOpen(true)}>+ Add company</button>}
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
              <p>Contacts appear automatically as leads come in — or add one yourself.</p>
              <button className="btn sm" onClick={() => setNewContactOpen(true)}>+ Add contact</button>
            </div>
          ) : (
            <table className="t">
              <thead><tr><th>Name</th><th>Phone</th><th>Email</th><th>Company</th><th>Activity</th><th /></tr></thead>
              <tbody>
                {contacts.map((c) => (
                  <tr key={c.id}>
                    <td><strong>{c.name}</strong>{(c.tags ?? []).map((t: string) => <span key={t} className="tag" style={{ marginLeft: 4, fontSize: 10 }}>{t}</span>)}</td>
                    <td className="muted">{c.phone ?? '—'}</td>
                    <td className="muted">{c.email ?? '—'}</td>
                    <td className="muted">{c.company?.name ?? '—'}</td>
                    <td className="muted">{c._count ? `${c._count.leads} leads · ${c._count.conversations} convos` : '—'}</td>
                    <td style={{ textAlign: 'right' }}><button className="btn ghost sm" onClick={() => openContact(c.id)}>Open</button></td>
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

      <Modal open={newContactOpen} onClose={() => setNewContactOpen(false)} title="Add a contact">
        <div className="field">
          <label htmlFor="ncname">Name</label>
          <input id="ncname" value={ncName} onChange={(e) => setNcName(e.target.value)} placeholder="Sam Carter" />
        </div>
        <div className="grid-2">
          <div className="field">
            <label htmlFor="ncphone">Phone</label>
            <input id="ncphone" value={ncPhone} onChange={(e) => setNcPhone(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="ncemail">Email</label>
            <input id="ncemail" value={ncEmail} onChange={(e) => setNcEmail(e.target.value)} />
          </div>
        </div>
        <div className="modal-actions">
          <button className="btn ghost sm" onClick={() => setNewContactOpen(false)}>Cancel</button>
          <button className="btn sm" disabled={saving || !ncName.trim()} onClick={createContact}>
            {saving ? 'Saving…' : 'Add contact'}
          </button>
        </div>
      </Modal>

      <Modal open={!!contactDetail} onClose={() => setContactDetail(null)} title={contactDetail?.name ?? 'Contact'}>
        {contactDetail && (
          <div style={{ maxHeight: '65vh', overflowY: 'auto' }}>
            <p className="muted" style={{ fontSize: 13 }}>
              {contactDetail.phone ?? 'no phone'} · {contactDetail.email ?? 'no email'}
              {contactDetail.company && ` · ${contactDetail.company.name}`}
            </p>
            {contactDetail.leads?.length > 0 && (<>
              <h4 style={{ margin: '10px 0 6px' }}>Opportunities</h4>
              {contactDetail.leads.map((l: any) => (
                <div className="agent-row" key={l.id}>
                  <span style={{ flex: 1 }}>{l.serviceType ?? 'Opportunity'}</span>
                  <span className="tag" style={{ fontSize: 10 }}>{l.stage}</span>
                  {l.estimatedValue != null && <span className="muted" style={{ fontSize: 12 }}>${Number(l.estimatedValue).toLocaleString()}</span>}
                </div>
              ))}
            </>)}
            {contactDetail.conversations?.length > 0 && (<>
              <h4 style={{ margin: '10px 0 6px' }}>Conversations</h4>
              {contactDetail.conversations.map((c: any) => (
                <div className="agent-row" key={c.id}>
                  <span style={{ flex: 1 }}>{c.channel}</span>
                  <span className="tag" style={{ fontSize: 10 }}>{c.status}</span>
                </div>
              ))}
            </>)}
            {contactDetail.payments?.length > 0 && (<>
              <h4 style={{ margin: '10px 0 6px' }}>Payments</h4>
              {contactDetail.payments.map((p: any) => (
                <div className="agent-row" key={p.id}>
                  <span style={{ flex: 1 }}>${Number(p.amount).toLocaleString()}</span>
                  <span className={`chip ${p.status === 'SUCCEEDED' ? 'ok' : 'warn'}`} style={{ fontSize: 10 }}>{p.status}</span>
                </div>
              ))}
            </>)}
            <h4 style={{ margin: '10px 0 6px' }}>Timeline</h4>
            {(contactDetail.activities ?? []).length === 0 ? (
              <p className="muted" style={{ fontSize: 12 }}>No recorded activity yet.</p>
            ) : (
              contactDetail.activities.map((a: any) => (
                <div className="agent-row" key={a.id}>
                  <span className="tag" style={{ fontSize: 10 }}>{a.type}</span>
                  <span style={{ flex: 1, fontSize: 13 }}>{a.title}</span>
                  <span className="muted" style={{ fontSize: 11 }}>{new Date(a.createdAt).toLocaleDateString()}</span>
                </div>
              ))
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
