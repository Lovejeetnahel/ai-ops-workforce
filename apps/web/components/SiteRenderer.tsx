'use client';
import { useState } from 'react';

/**
 * Renders a SitePage's typed sections. Used by the in-app editor preview AND
 * the public /s/[site]/[page] route so what you preview is what visitors get.
 * The contact section posts to the real public form endpoint when siteSlug/
 * pageSlug are provided (public mode); in preview mode it is disabled.
 */
export function SiteRenderer({ sections, business, siteSlug, pageSlug, apiBase }: {
  sections: any[];
  business?: string;
  siteSlug?: string;
  pageSlug?: string;
  apiBase?: string;
}) {
  const [form, setForm] = useState({ name: '', phone: '', email: '', message: '' });
  const [formState, setFormState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const live = !!(siteSlug && pageSlug && apiBase);

  const submit = async () => {
    if (!live || !form.name.trim() || (!form.phone && !form.email)) return;
    setFormState('sending');
    try {
      const res = await fetch(`${apiBase}/api/public/sites/${siteSlug}/${pageSlug}/form`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...form, source: 'website_form' }),
      });
      if (!res.ok) throw new Error();
      setFormState('done');
    } catch { setFormState('error'); }
  };

  const gold = '#ffc629';
  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', lineHeight: 1.5 }}>
      {(sections ?? []).map((s: any, i: number) => {
        switch (s.type) {
          case 'hero':
            return (
              <section key={i} style={{ padding: '72px 24px', textAlign: 'center', background: '#0d0d0f', color: '#fff' }}>
                <h1 style={{ fontSize: 40, margin: 0 }}>{s.headline ?? business ?? ''}</h1>
                {s.subheadline && <p style={{ fontSize: 18, opacity: 0.8, maxWidth: 640, margin: '16px auto' }}>{s.subheadline}</p>}
                {s.ctaLabel && <a href={s.ctaHref ?? '#contact'} style={{ display: 'inline-block', marginTop: 12, padding: '12px 28px', background: gold, color: '#0a0a0a', borderRadius: 10, fontWeight: 700, textDecoration: 'none' }}>{s.ctaLabel}</a>}
              </section>
            );
          case 'services':
            return (
              <section key={i} style={{ padding: '56px 24px', maxWidth: 960, margin: '0 auto' }}>
                <h2>{s.title ?? 'What we do'}</h2>
                {(s.items ?? []).length === 0 ? <p style={{ opacity: 0.6 }}>Services will be listed here.</p> : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
                    {s.items.map((it: any, j: number) => (
                      <div key={j} style={{ border: `1px solid ${gold}33`, borderRadius: 12, padding: 18 }}>
                        <strong>{it.name ?? it.title ?? it}</strong>
                        {it.description && <p style={{ fontSize: 14, opacity: 0.75 }}>{it.description}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            );
          case 'testimonials':
            return (
              <section key={i} style={{ padding: '56px 24px', maxWidth: 960, margin: '0 auto' }}>
                <h2>{s.title ?? 'What customers say'}</h2>
                {(s.items ?? []).length === 0 ? <p style={{ opacity: 0.6 }}>No testimonials published yet.</p> : (
                  s.items.map((t: any, j: number) => (
                    <blockquote key={j} style={{ borderLeft: `3px solid ${gold}`, margin: '16px 0', paddingLeft: 16 }}>
                      <p style={{ margin: 0 }}>&ldquo;{t.quote}&rdquo;</p>
                      {t.name && <cite style={{ fontSize: 13, opacity: 0.7 }}>— {t.name}</cite>}
                    </blockquote>
                  ))
                )}
              </section>
            );
          case 'faq':
            return (
              <section key={i} style={{ padding: '56px 24px', maxWidth: 760, margin: '0 auto' }}>
                <h2>{s.title ?? 'Common questions'}</h2>
                {(s.items ?? []).map((f: any, j: number) => (
                  <details key={j} style={{ borderBottom: '1px solid rgba(128,128,128,0.25)', padding: '10px 0' }}>
                    <summary style={{ cursor: 'pointer', fontWeight: 600 }}>{f.q ?? f.question}</summary>
                    <p style={{ opacity: 0.8 }}>{f.a ?? f.answer}</p>
                  </details>
                ))}
              </section>
            );
          case 'contact':
            return (
              <section key={i} id="contact" style={{ padding: '56px 24px', maxWidth: 560, margin: '0 auto' }}>
                <h2>{s.title ?? 'Get in touch'}</h2>
                {formState === 'done' ? (
                  <p style={{ padding: 16, border: '1px solid #2a2', borderRadius: 10 }}>Thanks — your message is in. The business will get back to you.</p>
                ) : (
                  <div style={{ display: 'grid', gap: 10 }}>
                    <input placeholder="Your name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={inp} />
                    <input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} style={inp} />
                    <input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} style={inp} />
                    <textarea placeholder="How can we help?" rows={3} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} style={inp} />
                    {formState === 'error' && <p style={{ color: '#f87171', fontSize: 13 }}>Could not send — try again.</p>}
                    <button onClick={submit} disabled={!live || formState === 'sending' || !form.name.trim() || (!form.phone && !form.email)}
                      title={live ? '' : 'Form submits on the published page'}
                      style={{ padding: '12px 20px', borderRadius: 10, background: gold, color: '#0a0a0a', border: 0, fontWeight: 700, cursor: live ? 'pointer' : 'not-allowed', opacity: live ? 1 : 0.6 }}>
                      {formState === 'sending' ? 'Sending…' : live ? 'Send' : 'Send (live on published page)'}
                    </button>
                  </div>
                )}
              </section>
            );
          case 'cta':
            return (
              <section key={i} style={{ padding: '48px 24px', textAlign: 'center', background: `${gold}14` }}>
                <h2 style={{ margin: 0 }}>{s.headline ?? 'Ready to get started?'}</h2>
                {s.ctaLabel && <a href={s.ctaHref ?? '#contact'} style={{ display: 'inline-block', marginTop: 14, padding: '12px 26px', background: gold, color: '#0a0a0a', borderRadius: 10, fontWeight: 700, textDecoration: 'none' }}>{s.ctaLabel}</a>}
              </section>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}

const inp: React.CSSProperties = { padding: '10px 12px', borderRadius: 8, border: '1px solid #666', background: 'transparent', color: 'inherit', fontSize: 14 };
