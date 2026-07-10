'use client';
import { useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import { Modal } from '../../../components/Modal';
import { useToast } from '../../../components/Toast';

const ROLES = ['STAFF', 'ADMIN'];

export default function SettingsPage() {
  const toast = useToast();
  const [config, setConfig] = useState<any>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('STAFF');
  const [saving, setSaving] = useState(false);

  useEffect(() => { api.moduleConfig().then(setConfig).catch(() => {}); }, []);

  const invite = async () => {
    if (!name.trim() || !email.trim()) return;
    setSaving(true);
    try {
      const tempPassword = Math.random().toString(36).slice(2, 10) + 'A1!';
      await api.inviteStaff({ email: email.trim(), password: tempPassword, name: name.trim(), role });
      toast.success('Team member added', `${name} can now sign in with a temporary password.`);
      setName(''); setEmail(''); setInviteOpen(false);
    } catch {
      toast.error('Could not add team member');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="topbar">
        <div>
          <h2 style={{ margin: 0 }}>Settings</h2>
          <span className="muted">Business settings and configuration</span>
        </div>
      </div>
      <div className="grid">
        <div className="panel">
          <h3>Business type</h3>
          <p className="muted">{config?.tagline ?? 'Drives your pipeline, forms, templates and automations.'}</p>
          <span className="tag">{config?.label ?? 'General business'}</span>
        </div>
        <div className="panel">
          <h3>Branding</h3>
          <p className="muted">Logo, colors and customer-portal theme. Light/dark toggle lives in the sidebar.</p>
        </div>
        <div className="panel">
          <h3>Team &amp; permissions</h3>
          <p className="muted">Owner · Admin · Staff · Customer. Invite teammates and assign roles.</p>
          <button className="btn sm" onClick={() => setInviteOpen(true)}>+ Invite team member</button>
        </div>
        <div className="panel">
          <h3>Integrations</h3>
          <p className="muted">Connect Twilio, Vapi, SendGrid, Google Calendar, Stripe and more from the Marketplace.</p>
        </div>
        <div className="panel">
          <h3>API &amp; developers</h3>
          <p className="muted">Create API keys and view usage for the public developer API.</p>
        </div>
        <div className="panel">
          <h3>Compliance</h3>
          <p className="muted">Audit logs, consent records, data export &amp; deletion, retention policy.</p>
        </div>
      </div>

      <Modal open={inviteOpen} onClose={() => setInviteOpen(false)} title="Invite a team member">
        <div className="field">
          <label htmlFor="iname">Name</label>
          <input id="iname" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jamie Rivera" />
        </div>
        <div className="field">
          <label htmlFor="iemail">Email</label>
          <input id="iemail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jamie@yourcompany.com" />
        </div>
        <div className="field">
          <label htmlFor="irole">Role</label>
          <select id="irole" value={role} onChange={(e) => setRole(e.target.value)}>
            {ROLES.map((r) => <option key={r} value={r}>{r.charAt(0) + r.slice(1).toLowerCase()}</option>)}
          </select>
        </div>
        <div className="modal-actions">
          <button className="btn ghost sm" onClick={() => setInviteOpen(false)}>Cancel</button>
          <button className="btn sm" disabled={saving || !name.trim() || !email.trim()} onClick={invite}>
            {saving ? 'Sending…' : 'Send invite'}
          </button>
        </div>
      </Modal>
    </>
  );
}
