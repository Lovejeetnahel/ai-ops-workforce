'use client';
import { useEffect, useState } from 'react';
import { api } from '../../../lib/api';

export default function SettingsPage() {
  const [config, setConfig] = useState<any>(null);
  useEffect(() => {
    api.moduleConfig().then(setConfig).catch(() => {});
  }, []);

  return (
    <>
      <div className="topbar">
        <div><h2 style={{ margin: 0 }}>Settings</h2><span className="muted">{config ? `${config.label} module` : 'Workspace configuration'}</span></div>
      </div>
      <div className="grid">
        <div className="panel">
          <h3>Industry module</h3>
          <p className="muted">{config?.tagline ?? 'Drives vocabulary, pipeline, intake, templates and automations.'}</p>
          <span className="tag">{config?.key ?? 'FIELD_SERVICES'}</span>
        </div>
        <div className="panel">
          <h3>Branding</h3>
          <p className="muted">Logo, colors and customer-portal theme. Light/dark toggle lives in the sidebar.</p>
        </div>
        <div className="panel">
          <h3>Users & permissions</h3>
          <p className="muted">Owner · Admin · Staff · Customer. Invite teammates and assign roles.</p>
          <button className="btn">Invite user</button>
        </div>
        <div className="panel">
          <h3>Integrations</h3>
          <p className="muted">Twilio · Vapi · SendGrid · Google Calendar · Stripe and 20+ connectors in the marketplace.</p>
        </div>
        <div className="panel">
          <h3>API & developers</h3>
          <p className="muted">Create API keys, view usage and the OpenAPI spec for the public /v1 API.</p>
        </div>
        <div className="panel">
          <h3>Compliance</h3>
          <p className="muted">Audit logs, consent records, data export & erasure (GDPR/PIPEDA), retention policy.</p>
        </div>
      </div>
    </>
  );
}
