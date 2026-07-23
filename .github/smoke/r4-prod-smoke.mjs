/**
 * Release 4 production smoke tests — run over HTTPS against api.sofilic.com /
 * sofilic.com AFTER deployment. Creates two clearly-marked verification
 * tenants ('ZZ RELEASE VERIFY …' — removed afterward by the workflow's
 * cleanup-test-tenants mode). Read-heavy; ZERO external-impact actions:
 * no messages, no payments, no approvals executed.
 */
const API = 'https://api.sofilic.com/api';
const WEB = 'https://sofilic.com';
let pass = 0, fail = 0;
const ok = (n, c, d = '') => { if (c) { pass++; console.log(`  PASS ${n}`); } else { fail++; console.log(`  FAIL ${n} ${d}`); } };

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
  const email = `release-verify-${suffix}-${ts}@example.test`;
  const s = await req('POST', '/tenants', { body: { name: `ZZ RELEASE VERIFY ${suffix} ${ts}`, firstName: 'Release', lastName: 'Verify', ownerEmail: email, ownerPassword: 'Verify#R4x9', industryModule: 'FIELD_SERVICES', presetKey: 'plumbing', country: 'CA', termsAccepted: true } });
  if (s.status !== 201 && s.status !== 200) throw new Error(`prod signup failed: ${s.status} ${JSON.stringify(s.json).slice(0, 200)}`);
  const l = await req('POST', '/auth/login', { body: { email, password: 'Verify#R4x9' } });
  return l.json.accessToken;
}

console.log('— public surface —');
for (const [p, want] of [['/', 200], ['/pricing', 200], ['/resources/getting-started', 200], ['/robots.txt', 200], ['/sitemap.xml', 200], ['/login', 200]]) {
  const r = await fetch(`${WEB}${p}`);
  ok(`web ${p} → ${want}`, r.status === want, String(r.status));
}
const health = await (await fetch(`${API}/health`)).json();
ok('api health = sofilic-api', health.service === 'sofilic-api');
const dash = await (await fetch(`${WEB}/dashboard`)).text();
ok('dashboard: noindex + no shell leak', dash.includes('name="robots" content="noindex') && !dash.includes('os-topbar'));

console.log('— auth + signup (Release 3 regression) —');
const A = await mk('A');
const B = await mk('B');
ok('two fresh tenants provisioned + logins work', !!(A && B));

console.log('— Business Brain (Sprint 1) live in production —');
const prof = await req('GET', '/business-brain/profile', { token: A });
ok('company profile endpoint live', prof.status === 200 && prof.json.businessName !== undefined);
const goal = await req('POST', '/business-brain/goals', { token: A, body: { title: 'ZZ verify goal', priority: 'HIGH' } });
ok('goal engine live (create)', goal.status === 201 || goal.status === 200);
ok('goal health derived', ['ON_TRACK', 'AT_RISK'].includes(goal.json?.health));
const kpi = await req('POST', '/business-brain/kpis', { token: A, body: { name: 'ZZ verify kpi', metricKey: 'revenue', targetValue: 1 } });
ok('KPI engine live (metric-bound)', (kpi.status === 201 || kpi.status === 200));
const klist = await req('GET', '/business-brain/kpis', { token: A });
const kv = (klist.json ?? []).find((k) => k.name === 'ZZ verify kpi');
ok('metric KPI computes real value (fresh tenant → 0, never fabricated)', kv?.currentValue === 0, JSON.stringify(kv)?.slice(0, 120));
const exec = await req('GET', '/business-brain/executive', { token: A });
ok('executive dashboard live', exec.status === 200 && typeof exec.json.healthScore === 'number');
ok('executive shows the verify goal', exec.json.goals.active.some((g) => g.title === 'ZZ verify goal'));
const mem = await req('POST', '/brain/knowledge', { token: A, body: { type: 'POLICY', title: 'ZZ verify policy', content: 'verification entry' } });
ok('business memory (existing Brain) live', mem.status === 201 || mem.status === 200, `status=${mem.status} body=${JSON.stringify(mem.json)?.slice(0, 200)}`);

console.log('— AI Workforce (Release 3/Phase 3 intact) —');
const roster = await req('GET', '/employees', { token: A });
ok('roster: 9 employees', roster.json?.length === 9, String(roster.json?.length));
ok('approval-first defaults hold in production', (roster.json ?? []).every((e) => e.installation?.authority === 'APPROVE'));
const ai = await req('GET', '/employees/ai-status', { token: A });
ok('ai-status honest (200)', ai.status === 200, JSON.stringify(ai.json)?.slice(0, 100));
const approvals = await req('GET', '/employees/approvals', { token: A });
ok('approvals endpoint live + empty for fresh tenant', approvals.status === 200 && (approvals.json ?? []).length === 0);

console.log('— tenant isolation in production —');
ok('B sees none of A\'s goals', ((await req('GET', '/business-brain/goals', { token: B })).json ?? []).length === 0);
ok('B cannot read A\'s goal by id', (await req('GET', `/business-brain/goals/${goal.json.id}`, { token: B })).status === 404);
ok('B cannot write A\'s goal progress', [400, 404].includes((await req('PATCH', `/business-brain/goals/${goal.json.id}/progress`, { token: B, body: { progress: 9 } })).status));
ok('B profile clean', (await req('GET', '/business-brain/profile', { token: B })).json.brandName === null);

console.log('— security spot checks —');
ok('anonymous business-brain denied', [401, 403].includes((await req('GET', '/business-brain/executive')).status));
ok('anonymous employees denied', [401, 403].includes((await req('GET', '/employees')).status));
const badLogin = await req('POST', '/auth/login', { body: { email: `release-verify-A-${ts}@example.test`, password: 'wrong-password-x1' } });
// 401 is the expected rejection; 429 means the per-IP login limiter fired
// first (shared runner egress) — still a rejection, reported distinctly.
ok('wrong password rejected (401, or 429 rate-limited first)', badLogin.status === 401 || badLogin.status === 429, `status=${badLogin.status} body=${JSON.stringify(badLogin.json)?.slice(0, 200)}`);

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
