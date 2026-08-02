/**
 * Sprint 2 production smoke — the Commercial Operating Layer, live over HTTPS.
 * Creates two 'ZZ RELEASE VERIFY S2…' tenants (the workflow's cleanup pattern
 * 'ZZ RELEASE VERIFY%' catches them). Provider-dependent behavior is asserted
 * CONDITIONALLY on the tenant's real channel status, so this suite is honest
 * whether or not Twilio/SendGrid are configured in production. It never
 * launches a real campaign send: only the approval gate is exercised, plus
 * the 503 setup-required path when providers are absent.
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
  const email = `s2-release-verify-${suffix}-${ts}@example.test`;
  const s = await req('POST', '/tenants', { body: { name: `ZZ RELEASE VERIFY S2${suffix} ${ts}`, firstName: 'S2', lastName: 'Verify', ownerEmail: email, ownerPassword: 'Verify#S2x9', industryModule: 'FIELD_SERVICES', presetKey: 'hvac', country: 'CA', termsAccepted: true } });
  if (s.status !== 201 && s.status !== 200) throw new Error(`prod signup failed: ${s.status} ${JSON.stringify(s.json).slice(0, 200)}`);
  const l = await req('POST', '/auth/login', { body: { email, password: 'Verify#S2x9' } });
  return l.json.accessToken;
}

console.log('— Sprint 2: preset runtime + onboarding —');
const A = await mk('A');
const B = await mk('B');
ok('two verify tenants provisioned', !!(A && B));
const cfg = await req('GET', '/config/module', { token: A });
ok('preset runtime schema live (widgets/KPIs/core)', cfg.status === 200 && Array.isArray(cfg.json.preset?.dashboardWidgets) && cfg.json.preset?.core === 'DISPATCH');
const apply = await req('POST', '/tenants/onboarding/apply', { token: A, body: { mainGoal: 'ZZ verify goal', acceptKpis: [{ name: 'Monthly revenue', metricKey: 'revenue', targetValue: 10000 }] } });
ok('onboarding apply (goal + KPI)', apply.status === 200 || apply.status === 201);
ok('KPI created with target', ((await req('GET', '/business-brain/kpis', { token: A })).json ?? []).some((k) => k.name === 'Monthly revenue' && k.targetValue === 10000));

console.log('— Sprint 2: contacts + inbox —');
const contact = await req('POST', '/contacts', { token: A, body: { name: 'ZZ Verify Contact', phone: '+15550100', email: 'zzv@example.test', tags: ['vip'] } });
ok('contacts API live', contact.status === 201 || contact.status === 200);
const convo = await req('POST', '/conversations', { token: A, body: { contactId: contact.json.id, channel: 'WEBCHAT', subject: 'ZZ verify thread', body: 'hello' } });
ok('inbox: conversation + first message', (convo.status === 200 || convo.status === 201) && convo.json.messages?.length === 1);
const cid = convo.json.id;
ok('inbox: internal note', ((await req('POST', `/conversations/${cid}/notes`, { token: A, body: { body: 'note' } })).json ?? {}).isInternal === true);
const channels = await req('GET', '/conversations/channels', { token: A });
ok('inbox: channel status endpoint', channels.status === 200 && Array.isArray(channels.json));
const smsConfigured = channels.json?.find((c) => c.channel === 'SMS')?.configured === true;
const closed = await req('PATCH', `/conversations/${cid}/status`, { token: A, body: { status: 'CLOSED' } });
ok('inbox: close sets closedAt', closed.status === 200 && !!closed.json.closedAt);

console.log('— Sprint 2: reviews —');
const review = await req('POST', '/reviews', { token: A, body: { contactId: contact.json.id, source: 'GOOGLE', rating: 2, text: 'ZZ verify review' } });
ok('review recorded', review.status === 200 || review.status === 201);
ok('review response recorded', [200, 201].includes((await req('POST', `/reviews/${review.json.id}/respond`, { token: A, body: { responseText: 'sorry!' } })).status));
const summary = await req('GET', '/reviews/summary', { token: A });
ok('reviews summary real', summary.status === 200 && summary.json.total === 1);
if (!smsConfigured) {
  const rr = await req('POST', '/reviews/requests', { token: A, body: { contactId: contact.json.id, channel: 'SMS' } });
  ok('review request honestly refuses without provider (503)', rr.status === 503, `status=${rr.status}`);
} else skipNote('review request 503 path', 'SMS provider IS configured in production');

console.log('— Sprint 2: marketing (no real sends) —');
const camp = await req('POST', '/marketing/campaigns', { token: A, body: { name: 'ZZ verify campaign', channel: 'SMS', content: 'hi {{name}}', audience: { tags: ['vip'] } } });
ok('campaign created DRAFT', [200, 201].includes(camp.status) && camp.json.status === 'DRAFT');
const prev = await req('POST', '/marketing/audience/preview', { token: A, body: { audience: { tags: ['vip'] }, channel: 'SMS' } });
ok('audience preview real counts', [200, 201].includes(prev.status) && prev.json.total === 1);
ok('start blocked before approval (400)', (await req('POST', `/marketing/campaigns/${camp.json.id}/start`, { token: A })).status === 400);
await req('POST', `/marketing/campaigns/${camp.json.id}/approve`, { token: A });
if (!smsConfigured) {
  ok('approved start honestly refuses without provider (503)', (await req('POST', `/marketing/campaigns/${camp.json.id}/start`, { token: A })).status === 503);
} else skipNote('campaign start', 'provider configured — not sending real messages from a smoke test');
const metrics = await req('GET', `/marketing/campaigns/${camp.json.id}/metrics`, { token: A });
ok('metrics honest (unavailable list, no fake opens)', metrics.status === 200 && (metrics.json.unavailable ?? []).includes('opens'));

console.log('— Sprint 2: social —');
const post = await req('POST', '/social/posts', { token: A, body: { platform: 'facebook', caption: 'ZZ verify post' } });
ok('post drafted', [200, 201].includes(post.status));
await req('POST', `/social/posts/${post.json.id}/submit`, { token: A });
const approved = await req('POST', `/social/posts/${post.json.id}/approve`, { token: A });
ok('approval flow', approved.json?.status === 'APPROVED');
const pub = await req('POST', `/social/posts/${post.json.id}/mark-published`, { token: A, body: {} });
ok('manual publish honesty note', pub.json?.status === 'PUBLISHED' && /manual/i.test(pub.json?.publishNote ?? ''));

console.log('— Sprint 2: sales outcomes + ROI + dashboard —');
const lead = await req('POST', '/leads', { token: A, body: { contactName: 'ZZ Verify Lead', serviceType: 'AC' } });
await req('PATCH', `/leads/${lead.json.id}`, { token: A, body: { estimatedValue: 500, campaignId: camp.json.id } });
const won = await req('PATCH', `/leads/${lead.json.id}/stage`, { token: A, body: { stage: 'COMPLETED', actualValue: 650 } });
ok('won with real actual value', won.status === 200 && Number(won.json.actualValue) === 650 && !!won.json.wonAt);
const detail = await req('GET', `/leads/${lead.json.id}`, { token: A });
ok('opportunity 360 detail', detail.status === 200 && detail.json.campaign?.id === camp.json.id);
const roi = await req('GET', '/control/roi', { token: A });
ok('ROI attribution read model live', roi.status === 200 && roi.json.attribution?.length === 5);
const ov = await req('GET', '/analytics/overview', { token: A });
ok('dashboard overview Sprint 2 snapshots', ov.status === 200 && ov.json.reviews?.total === 1 && ov.json.marketing != null);

console.log('— Sprint 2: automation ops —');
const events = await req('GET', '/automation/events', { token: A });
ok('event catalog incl. Sprint 2 events', events.status === 200 && events.json.includes('review.received'));
const recipes = await req('GET', '/automation/recipes', { token: A });
ok('industry recipes seeded', recipes.status === 200 && recipes.json.length >= 4);
ok('execution history live', ((await req('GET', '/automation/history', { token: A })).json ?? []).length > 0);

console.log('— Sprint 2: isolation + RBAC —');
ok('B sees no A conversations', ((await req('GET', '/conversations', { token: B })).json ?? []).length === 0);
ok('B cannot read A conversation', (await req('GET', `/conversations/${cid}`, { token: B })).status === 404);
ok('B cannot read A campaign', (await req('GET', `/marketing/campaigns/${camp.json.id}`, { token: B })).status === 404);
ok('B sees no A reviews', ((await req('GET', '/reviews', { token: B })).json ?? []).length === 0);
ok('anonymous denied on inbox', [401, 403].includes((await req('GET', '/conversations')).status));
ok('anonymous denied on roi', [401, 403].includes((await req('GET', '/control/roi')).status));

console.log(`\nRESULT: ${pass} passed, ${fail} failed, ${skip} skipped`);
process.exit(fail ? 1 : 0);
