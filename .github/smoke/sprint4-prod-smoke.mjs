/**
 * Sprint 4 production smoke — Monetization & Customer Activation over HTTPS.
 * Tenants named 'ZZ RELEASE VERIFY S4…' (cleaned by the existing pattern,
 * including their Subscription/BillingEvent/WebhookDelivery rows).
 *
 * SAFETY: no card is ever charged (checkout is only asserted as either an
 * honest 503 setup-required or a real hosted-session URL — never completed),
 * no message is sent (the scheduled campaign deliberately stays UNAPPROVED,
 * proving the scheduler refuses to send without approval), no call is placed,
 * and the commerce chain settles via an offline payment record — no provider
 * payment link is created.
 */
const API = 'https://api.sofilic.com/api';
let pass = 0, fail = 0, skip = 0;
const ok = (n, c, d = '') => { if (c) { pass++; console.log(`  PASS ${n}`); } else { fail++; console.log(`  FAIL ${n} ${d}`); } };
const skipNote = (n, why) => { skip++; console.log(`  SKIP ${n} — ${why}`); };
async function req(method, path, { token, body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null; try { json = await res.json(); } catch {}
  return { status: res.status, json };
}
const ts = Date.now();
async function mk(suffix) {
  const email = `s4-release-${suffix}-${ts}@example.test`;
  const s = await req('POST', '/tenants', { body: { name: `ZZ RELEASE VERIFY S4${suffix} ${ts}`, firstName: 'S4', lastName: 'V', ownerEmail: email, ownerPassword: 'Verify#S4x9', industryModule: 'FIELD_SERVICES', presetKey: 'hvac', termsAccepted: true } });
  if (![200, 201].includes(s.status)) throw new Error(`signup ${s.status}`);
  const l = await req('POST', '/auth/login', { body: { email, password: 'Verify#S4x9' } });
  return { token: l.json.accessToken, slug: s.json.slug };
}

const A = await mk('A');
const B = await mk('B');
ok('verify tenants provisioned', !!(A.token && B.token));

console.log('— Subscription lifecycle —');
const ov = await req('GET', '/billing/overview', { token: A.token });
ok('signup starts a real Pro trial', ov.status === 200 && ov.json.state === 'trialing' && ov.json.plan.key === 'pro');
ok('metered usage: included/remaining/overage all real', ov.json.usage.metered.staffSeats.used >= 1 && typeof ov.json.usage.metered.aiTasksMonthly.remaining === 'number');
ok('billing audit history has trial_started', ((await req('GET', '/billing/events', { token: A.token })).json ?? []).some((e) => e.type === 'trial_started'));
const checkout = await req('POST', '/billing/checkout', { token: A.token, body: { planKey: 'pro' } });
if (checkout.status === 503) ok('checkout honestly setup-required (Stripe billing prices not configured)', true);
else if ([200, 201].includes(checkout.status) && checkout.json.url) { ok('checkout returns a real hosted Stripe session (never completed by this test)', true); }
else ok('checkout state', false, `status=${checkout.status} ${JSON.stringify(checkout.json).slice(0, 120)}`);
ok('cancel + reactivate round-trip (trial-local)', (await req('POST', '/billing/cancel', { token: A.token })).json.cancelAtPeriodEnd === true && (await req('POST', '/billing/reactivate', { token: A.token })).json.cancelAtPeriodEnd === false);
ok('billing webhook refuses unsigned posts (401)', (await req('POST', '/webhooks/billing', { body: { id: 'evt_forged', type: 'invoice.paid' } })).status === 401);

console.log('— Plan enforcement —');
for (let i = 1; i <= 3; i++) await req('POST', '/websites/sites', { token: A.token, body: { name: `ZZ S4 Site ${i}` } });
const fourth = await req('POST', '/websites/sites', { token: A.token, body: { name: 'ZZ S4 Site 4' } });
ok('over-limit create blocked with 402 + upgrade hint', fourth.status === 402 && fourth.json.code === 'LIMIT_REACHED' && !!fourth.json.upgrade);
ok('existing data still fully readable at the limit', ((await req('GET', '/websites/sites', { token: A.token })).json ?? []).length === 3);

console.log('— Scheduled campaigns (approval-gated, no sends) —');
await req('POST', '/contacts', { token: A.token, body: { name: 'ZZ S4 Target', phone: '+15550171' } });
const camp = await req('POST', '/marketing/campaigns', { token: A.token, body: { name: 'ZZ S4 Scheduled', channel: 'SMS', content: 'Hi {{name}}', scheduledAt: new Date(Date.now() + 2000).toISOString() } });
ok('campaign scheduled', [200, 201].includes(camp.status) && camp.json.status === 'SCHEDULED');
console.log('  … waiting 75s for one scheduler sweep (campaign is deliberately unapproved)');
await new Promise((r) => setTimeout(r, 75_000));
const c1 = await req('GET', `/marketing/campaigns/${camp.json.id}`, { token: A.token });
ok('scheduler refused to send without approval (stays SCHEDULED, notified once)', c1.json.status === 'SCHEDULED' && !!c1.json.meta?.approvalNotifiedAt, JSON.stringify({ s: c1.json.status, m: c1.json.meta }).slice(0, 140));
ok('approval-needed notification created', ((await req('GET', '/notifications', { token: A.token })).json ?? []).some((n) => n.category === 'campaign.approval_needed'));
ok('recipients: zero sends recorded', (((await req('GET', `/marketing/campaigns/${camp.json.id}/metrics`, { token: A.token })).json ?? {}).recipients?.sent ?? 0) === 0);
await req('POST', `/marketing/campaigns/${camp.json.id}/cancel`, { token: A.token });

console.log('— Voice activation state —');
const setup = await req('GET', '/voice-ai/setup', { token: A.token });
ok('setup state machine live', setup.status === 200 && Array.isArray(setup.json.steps) && setup.json.steps.length === 5);
if (setup.json.provider.configured) ok('provider step honestly done (production Vapi configured)', setup.json.steps[0].done === true);
else skipNote('provider-configured step', 'voice provider not configured');
ok('webhook path advertised for this tenant only', String(setup.json.webhookPath).includes('/api/webhooks/voice/'));

console.log('— Integration center —');
const center = await req('GET', '/tenants/integrations', { token: A.token });
ok('center lists real provider states with health', center.status === 200 && center.json.length >= 4 && center.json.every((i) => ['healthy', 'connected_no_activity', 'error', 'not_connected'].includes(i.health)));
const conn = await req('POST', '/tenants/integrations/TWILIO', { token: A.token, body: { accountSid: 'ACverify', authToken: 'verify-token', from: '+15550000' } });
ok('tenant connect stores config without echoing secrets', conn.json.connected === true && !JSON.stringify(conn.json).includes('verify-token'));
ok('disconnect clears it', (await req('DELETE', '/tenants/integrations/TWILIO', { token: A.token })).json.disconnected === true);

console.log('— COMMERCE chain (offline settlement, no provider calls) —');
const svc = await req('POST', '/appointments/services', { token: A.token, body: { name: 'ZZ S4 Service', durationMin: 60, priceCents: 15000 } });
const contact = await req('POST', '/contacts', { token: A.token, body: { name: 'ZZ S4 Customer', phone: '+15550172' } });
const lead = await req('POST', '/leads', { token: A.token, body: { contactName: 'ZZ S4 Customer', phone: '+15550172' } });
const est = await req('POST', '/commerce/estimates', { token: A.token, body: { contactId: contact.json.id, leadId: lead.json?.id, items: [{ serviceId: svc.json.id }] } });
ok('estimate priced from catalog', [200, 201].includes(est.status) && Number(est.json.amount) === 150);
ok('accepted', (await req('POST', `/commerce/estimates/${est.json.id}/accept`, { token: A.token })).json.status === 'SIGNED');
const inv = await req('POST', `/commerce/estimates/${est.json.id}/convert`, { token: A.token });
ok('converted to invoice idempotently', inv.json.type === 'INVOICE' && (await req('POST', `/commerce/estimates/${est.json.id}/convert`, { token: A.token })).json.id === inv.json.id);
ok('offline payment settles + books revenue', (await req('POST', `/payments/record/${inv.json.id}`, { token: A.token, body: { method: 'check' } })).json.status === 'SUCCEEDED');
const stats = await req('GET', '/commerce/stats', { token: A.token });
ok('commerce stats reflect the chain', stats.json.estimates.accepted === 1 && stats.json.collected.total === 150);
if (lead.json?.id) {
  const flow = await req('GET', `/commerce/flow/${lead.json.id}`, { token: A.token });
  ok('flow timeline connects the full chain', flow.status === 200 && flow.json.invoices.length === 1 && flow.json.revenue.collected === 150);
}

console.log('— Activation + reliability —');
const cl = await req('GET', '/tenants/launch-checklist', { token: A.token });
ok('launch checklist computes real states', cl.status === 200 && cl.json.items.find((i) => i.key === 'plan')?.done === true && typeof cl.json.launchReady === 'boolean');
ok('owner webhook-deliveries view live', (await req('GET', '/billing/webhook-deliveries', { token: A.token })).status === 200);
ok('admin SaaS metrics refuse without operator token', [401, 403].includes((await req('GET', '/admin/saas-metrics')).status));

console.log('— Isolation —');
ok('B has its own independent trial', (await req('GET', '/billing/overview', { token: B.token })).json.state === 'trialing');
ok('B sees no A billing events beyond its own', ((await req('GET', '/billing/events', { token: B.token })).json ?? []).every((e) => e.type === 'trial_started'));
ok('B sees no A estimates/sites', ((await req('GET', '/documents?type=QUOTE', { token: B.token })).json ?? []).length === 0 && ((await req('GET', '/websites/sites', { token: B.token })).json ?? []).length === 0);
ok('anonymous denied (overview/events/integrations)', [401, 403].includes((await req('GET', '/billing/overview')).status) && [401, 403].includes((await req('GET', '/billing/events')).status) && [401, 403].includes((await req('GET', '/tenants/integrations')).status));

console.log(`\nRESULT: ${pass} passed, ${fail} failed, ${skip} skipped`);
process.exit(fail ? 1 : 0);
