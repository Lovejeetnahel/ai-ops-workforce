'use client';
import Link from 'next/link';
import { useState } from 'react';
import { api } from '../../../lib/api';

const TOPICS = [
  { key: 'general', label: 'General question' },
  { key: 'sales', label: 'Sales & Enterprise' },
  { key: 'support', label: 'Account support' },
  { key: 'security', label: 'Security' },
];

export default function ContactPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [topic, setTopic] = useState('general');
  const [message, setMessage] = useState('');
  const [website, setWebsite] = useState(''); // honeypot — real visitors never see this field
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('sending');
    try {
      await api.contactUs({ name, email, company: company || undefined, topic, message, website: website || undefined });
      setStatus('sent');
    } catch {
      setStatus('error');
    }
  };

  if (status === 'sent') {
    return (
      <main className="mk-main">
        <section className="hero" style={{ padding: '96px 0' }}>
          <h1 style={{ fontSize: 'clamp(28px, 4vw, 40px)' }}>Message sent</h1>
          <p className="hero-sub">Thanks for reaching out — we’ll get back to you at the email you provided.</p>
          <div className="hero-ctas">
            <Link href="/" className="btn ghost">Back to homepage</Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="mk-main">
      <section className="hero" style={{ padding: '64px 0 20px' }}>
        <h1 style={{ fontSize: 'clamp(30px, 5vw, 44px)' }}>Contact <span className="grad-text">Sofilic</span></h1>
        <p className="hero-sub">Sales, support or security — tell us what you need and we’ll follow up by email.</p>
      </section>

      <section className="mk-section" style={{ paddingTop: 10 }}>
        <form onSubmit={submit} className="contact-form panel" style={{ padding: 30 }}>
          {status === 'error' && (
            <div className="auth-err" style={{ marginBottom: 16 }}>
              Something went wrong sending your message. Please try again in a minute.
            </div>
          )}
          <div className="field">
            <label htmlFor="c-name">Your name</label>
            <input id="c-name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Jamie Rivera" />
          </div>
          <div className="field">
            <label htmlFor="c-email">Email</label>
            <input id="c-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@yourcompany.com" />
          </div>
          <div className="field">
            <label htmlFor="c-company">Company (optional)</label>
            <input id="c-company" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Your business name" />
          </div>
          <div className="field">
            <label htmlFor="c-topic">Topic</label>
            <select id="c-topic" value={topic} onChange={(e) => setTopic(e.target.value)}>
              {TOPICS.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="c-message">Message</label>
            <textarea
              id="c-message" required rows={5} value={message} onChange={(e) => setMessage(e.target.value)}
              placeholder="What can we help with?"
              style={{ width: '100%', background: 'var(--panel-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', color: 'var(--text)', fontFamily: 'inherit', fontSize: 14, resize: 'vertical' }}
            />
          </div>
          {/* Honeypot — hidden from real visitors via CSS, not display:none (some bots skip those) */}
          <div className="contact-hp" aria-hidden="true">
            <label htmlFor="c-website">Leave this field empty</label>
            <input id="c-website" name="website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
          </div>
          <button className="btn" type="submit" disabled={status === 'sending'} style={{ width: '100%', marginTop: 6 }}>
            {status === 'sending' ? 'Sending…' : 'Send message'}
          </button>
        </form>
      </section>
    </main>
  );
}
