/**
 * Sprint 3 production smoke — Customer Delivery & Growth layer over HTTPS.
 * Tenants named 'ZZ RELEASE VERIFY S3…' (cleaned by the existing pattern).
 * Provider-dependent assertions are conditional on real configuration; no
 * simulated calls/sends anywhere. Public flows (booking link, site render,
 * form) are exercised for real inside the verify tenant, then cascade-deleted.
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
  const email = `s3-release-${suffix}-${ts}@example.test`;
  const s = await req('POST', '/tenants', { body: { name: `ZZ RELEASE VERIFY S3${suffix} ${ts}`, firstName: 'S3', lastName: 'V', ownerEmail: email, ownerPassword: 'Verify#S3x9', industryModule: 'FIELD_SERVICES', presetKey: 'hvac', termsAccepted: true } });
  if (![200, 201].includes(s.status)) throw new Error(`signup ${s.status}`);
  const l = await req('POST', '/auth/login', { body: { email, password: 'Verify#S3x9' } });
  return { token: l.json.accessToken, slug: s.json.slug };
}

const A = await mk('A');
const B = await mk('B');
ok('verify tenants provisioned', !!(A.token && B.token));

console.log('— Voice AI —');
const va = await req('POST', '/voice-ai/agents', { token: A.token, body: { name: 'ZZ Front desk' } });
ok('voice agent created off-by-default', [200, 201].includes(va.status) && va.json.enabled === false);
const agents = await req('GET', '/voice-ai/agents', { token: A.token });
const voiceConfigured = agents.json?.[0]?.phoneConnected === true;
if (!voiceConfigured) ok('enable honestly refused without provider', (await req('PATCH', `/voice-ai/agents/${va.json.id}`, { token: A.token, body: { enabled: true } })).status === 400);
else skipNote('enable-refusal path', 'voice provider IS configured in production');
const vu = await req('GET', '/voice-ai/usage', { token: A.token });
ok('voice usage honest for fresh tenant (0 calls)', vu.status === 200 && vu.json.calls === 0);

console.log('— Appointments + public booking —');
const svc = await req('POST', '/appointments/services', { token: A.token, body: { name: 'ZZ Tune-up', durationMin: 45 } });
const link = await req('POST', '/appointments/links', { token: A.token, body: { name: 'ZZ Book', serviceId: svc.json.id } });
ok('service + booking link created', !!link.json?.slug);
ok('public link resolves without auth', (await req('GET', `/public/book/${link.json.slug}`)).status === 200);
const team = await req('GET', '/tenants/team', { token: A.token });
const ownerId = team.json[0].id;
for (const d of [1, 2, 3, 4, 5]) await req('POST', `/schedule/working-hours/${ownerId}`, { token: A.token, body: { weekday: d, startMin: 540, endMin: 1020 } }).catch(() => null);
const slots = await req('GET', `/public/book/${link.json.slug}/slots`);
const slot = (slots.json.staff ?? [])[0]?.slots?.[0];
if (slot) {
  const start = slot.start ?? slot;
  const booked = await req('POST', `/public/book/${link.json.slug}`, { body: { userId: ownerId, start, name: 'ZZ Public Customer', phone: '+15550140' } });
  ok('public self-booking creates real REQUESTED appointment', booked.json?.ok === true, JSON.stringify(booked.json).slice(0, 140));
  ok('stats reflect it', ((await req('GET', '/appointments/stats', { token: A.token })).json.upcoming7d ?? 0) >= 1);
} else skipNote('public booking', 'no derivable slots (availability empty)');

console.log('— Websites + SEO —');
const site = await req('POST', '/websites/sites', { token: A.token, body: { name: 'ZZ Site' } });
const pg = await req('POST', '/websites/pages', { token: A.token, body: { siteId: site.json.id, title: 'Home', fromTemplate: 'landing' } });
ok('site + page created', [200, 201].includes(pg.status));
ok('draft not public (404)', (await req('GET', `/public/sites/${site.json.slug}/home`)).status === 404);
await req('POST', `/websites/pages/${pg.json.id}/publish`, { token: A.token });
ok('published page served publicly', (await req('GET', `/public/sites/${site.json.slug}/home`)).status === 200);
ok('public form → CRM lead', [200, 201].includes((await req('POST', `/public/sites/${site.json.slug}/home/form`, { body: { name: 'ZZ Web Visitor', phone: '+15550150' } })).status));
ok('submission linked to lead', ((await req('GET', '/websites/submissions', { token: A.token })).json ?? []).some((s) => s.leadId));
const audit = await req('POST', '/seo/audit', { token: A.token });
ok('SEO audit deterministic + external setup-required', [200, 201].includes(audit.status) && audit.json.external?.searchConsole === 'setup-required');

console.log('— Notifications + locations + usage + security + search —');
ok('staff notifications exist from real events', ((await req('GET', '/notifications', { token: A.token })).json ?? []).length >= 1);
ok('location + executive rollup', [200, 201].includes((await req('POST', '/locations', { token: A.token, body: { name: 'ZZ Main' } })).status) && ((await req('GET', '/locations/executive', { token: A.token })).json.locations ?? []).length >= 2);
const usage = await req('GET', '/billing/usage', { token: A.token });
ok('usage real counts, honest billing-portal state', usage.status === 200 && usage.json.usage.staffUsers.used >= 1 && usage.json.billingPortal.available === false);
ok('sessions listed', ((await req('GET', '/auth/sessions', { token: A.token })).json ?? []).length >= 1);
ok('wrong current password rejected', (await req('POST', '/auth/change-password', { token: A.token, body: { currentPassword: 'wrong-pass-1', newPassword: 'NewPassw0rd!!' } })).status === 401);
ok('global search finds real data', ((await req('GET', '/search?q=ZZ Web', { token: A.token })).json.results ?? []).some((r) => r.label === 'ZZ Web Visitor'));

console.log('— Customer portal —');
const contact = await req('POST', '/contacts', { token: A.token, body: { name: 'ZZ Portal Cust', email: `pc-${ts}@example.test` } });
await req('POST', '/portal/auth/users', { token: A.token, body: { contactId: contact.json.id, email: `pc-${ts}@example.test`, password: 'Portal#123' } });
const plog = await req('POST', '/portal/auth/login', { body: { tenantSlug: A.slug, email: `pc-${ts}@example.test`, password: 'Portal#123' } });
ok('portal login', !!plog.json?.accessToken);
ok('portal appointments/payments endpoints', (await req('GET', '/portal/appointments', { token: plog.json.accessToken })).status === 200 && (await req('GET', '/portal/payments', { token: plog.json.accessToken })).status === 200);
ok('portal token cannot reach staff APIs', [401, 403].includes((await req('GET', '/conversations', { token: plog.json.accessToken })).status));

console.log('— Isolation —');
ok('B sees no A voice agents', ((await req('GET', '/voice-ai/agents', { token: B.token })).json ?? []).length === 0);
ok('B sees no A sites', ((await req('GET', '/websites/sites', { token: B.token })).json ?? []).length === 0);
ok('B sees no A locations', ((await req('GET', '/locations', { token: B.token })).json ?? []).length === 0);
ok('anonymous denied (voice/notifications/usage)', [401, 403].includes((await req('GET', '/voice-ai/agents')).status) && [401, 403].includes((await req('GET', '/notifications')).status) && [401, 403].includes((await req('GET', '/billing/usage')).status));

console.log(`\nRESULT: ${pass} passed, ${fail} failed, ${skip} skipped`);
process.exit(fail ? 1 : 0);
