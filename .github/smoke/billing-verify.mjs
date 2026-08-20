/**
 * End-to-end TEST-MODE billing verification against production
 * (https://api.sofilic.com). Runs on the GitHub Actions runner with
 * STRIPE_BILLING_SECRET_KEY from GitHub secrets (masked; never printed).
 *
 * SAFETY:
 *  • REFUSES to run with a live-mode key — no real charge is possible.
 *  • Uses Stripe's shared test PaymentMethods (pm_card_visa /
 *    pm_card_chargeCustomerFail); no card number ever appears anywhere.
 *  • The hosted Checkout session is created and asserted but never completed;
 *    the paid subscription is created via the Stripe TEST API on the same
 *    customer, which drives the REAL webhook → sync → entitlement pipeline.
 *  • Verify tenants are named 'ZZ RELEASE VERIFY…' (cleaned by the remote
 *    step) and Stripe test customers are deleted at the end.
 */
const API = 'https://api.sofilic.com/api';
const KEY = (process.env.STRIPE_BILLING_SECRET_KEY ?? '').trim();
let pass = 0, fail = 0;
const ok = (n, c, d = '') => { if (c) { pass++; console.log(`  PASS ${n}`); } else { fail++; console.log(`  FAIL ${n} ${d}`); } };

if (!/^(sk|rk)_test_/.test(KEY)) {
  console.error('REFUSED: billing-verify only runs with a TEST-mode key. Live verification requires explicit founder approval and a separate plan.');
  process.exit(1);
}

async function req(method, path, { token, body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null; try { json = await res.json(); } catch {}
  return { status: res.status, json };
}
async function stripe(method, path, form) {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method,
    headers: { Authorization: `Bearer ${KEY}`, ...(form ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) },
    body: form ? new URLSearchParams(form) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Stripe ${method} ${path}: ${data?.error?.message ?? res.status}`);
  return data;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function pollOverview(token, predicate, label, timeoutMs = 120_000) {
  const start = Date.now();
  let last = null;
  while (Date.now() - start < timeoutMs) {
    last = (await req('GET', '/billing/overview', { token })).json;
    if (last && predicate(last)) return last;
    await sleep(4000);
  }
  console.log(`  (poll timeout for ${label}; last state=${last?.state} plan=${last?.plan?.key})`);
  return last;
}

const ts = Date.now();
async function mk(suffix) {
  const email = `s4b-${suffix}-${ts}@example.test`;
  const s = await req('POST', '/tenants', { body: { name: `ZZ RELEASE VERIFY BILLING ${suffix} ${ts}`, firstName: 'B', lastName: 'V', ownerEmail: email, ownerPassword: 'Verify#B1x9', industryModule: 'FIELD_SERVICES', presetKey: 'hvac', termsAccepted: true } });
  if (![200, 201].includes(s.status)) throw new Error(`signup ${s.status}`);
  const l = await req('POST', '/auth/login', { body: { email, password: 'Verify#B1x9' } });
  return { token: l.json.accessToken, email };
}

console.log('— Signup → trial —');
const A = await mk('A');
const ovTrial = await req('GET', '/billing/overview', { token: A.token });
ok('signup → real Pro trial', ovTrial.json.state === 'trialing' && ovTrial.json.plan.key === 'pro');

console.log('— Checkout session (created, never completed) —');
const checkout = await req('POST', '/billing/checkout', { token: A.token, body: { planKey: 'starter' } });
ok('hosted Checkout session created with URL', [200, 201].includes(checkout.status) && String(checkout.json.url ?? '').startsWith('https://checkout.stripe.com'), JSON.stringify(checkout.json).slice(0, 160));

const customerId = (await req('GET', '/billing/overview', { token: A.token })).json.subscription?.stripeCustomerId;
ok('Stripe customer created for tenant', !!customerId);

console.log('— Successful test payment → webhook → active subscription —');
const prices = await stripe('GET', '/prices?active=true&limit=100');
const priceOf = (plan) => (prices.data ?? []).find((p) => p.metadata?.sofilic_plan === plan && p.recurring?.interval === 'month')?.id;
ok('provisioned prices found (starter/pro/enterprise)', !!priceOf('starter') && !!priceOf('pro') && !!priceOf('enterprise'));
await stripe('POST', `/payment_methods/pm_card_visa/attach`, { customer: customerId });
await stripe('POST', `/customers/${customerId}`, { 'invoice_settings[default_payment_method]': 'pm_card_visa' });
const sub = await stripe('POST', '/subscriptions', {
  customer: customerId,
  'items[0][price]': priceOf('starter'),
  // tenant resolution happens server-side via the stored stripeCustomerId
  payment_behavior: 'error_if_incomplete',
});
ok('test-mode subscription created + paid at Stripe', sub.status === 'active');
const ovActive = await pollOverview(A.token, (o) => o.state === 'active' && o.plan.key === 'starter', 'active/starter');
ok('webhook synced: production shows ACTIVE on STARTER (provider-confirmed)', ovActive?.state === 'active' && ovActive?.plan?.key === 'starter');
ok('renewal date from provider', !!ovActive?.renewsAt);
ok('payment method surfaced (visa •••• 4242)', ovActive?.paymentMethod?.onFile === true && ovActive?.paymentMethod?.last4 === '4242');

console.log('— Entitlements now follow the PAID plan (starter sites limit = 1) —');
const site1 = await req('POST', '/websites/sites', { token: A.token, body: { name: 'ZZ B Site 1' } });
const site2 = await req('POST', '/websites/sites', { token: A.token, body: { name: 'ZZ B Site 2' } });
ok('1st site allowed, 2nd blocked 402 under starter', [200, 201].includes(site1.status) && site2.status === 402 && site2.json.code === 'LIMIT_REACHED', `s1=${site1.status} s2=${site2.status}`);

console.log('— Billing portal + invoices —');
let portal = await req('POST', '/billing/portal', { token: A.token });
if (portal.status >= 400 && String(portal.json?.message ?? '').toLowerCase().includes('configuration')) {
  // Test mode needs a default portal configuration once — create it via API.
  await stripe('POST', '/billing_portal/configurations', {
    'features[invoice_history][enabled]': 'true',
    'features[payment_method_update][enabled]': 'true',
    'features[subscription_cancel][enabled]': 'true',
    'business_profile[headline]': 'Sofilic billing',
  });
  portal = await req('POST', '/billing/portal', { token: A.token });
}
ok('Billing Portal session opens', [200, 201].includes(portal.status) && String(portal.json.url ?? '').includes('billing.stripe.com'), JSON.stringify(portal.json).slice(0, 140));
const invoices = await req('GET', '/billing/invoices', { token: A.token });
ok('real test invoice appears in history (paid)', invoices.json.available === true && (invoices.json.invoices ?? []).some((i) => i.status === 'paid' && i.amountPaid === 99));

console.log('— Upgrade (starter → pro, prorated in place) —');
const change = await req('POST', '/billing/change-plan', { token: A.token, body: { planKey: 'pro' } });
ok('change-plan accepted (no checkout needed)', change.status < 300 && change.json.requiresCheckout === false, JSON.stringify(change.json).slice(0, 120));
const ovPro = await pollOverview(A.token, (o) => o.plan.key === 'pro' && o.state === 'active', 'active/pro');
ok('production shows PRO active after provider sync', ovPro?.plan?.key === 'pro');
const site2b = await req('POST', '/websites/sites', { token: A.token, body: { name: 'ZZ B Site 2' } });
ok('entitlements widened after upgrade (2nd site now allowed)', [200, 201].includes(site2b.status));

console.log('— Cancel-at-period-end + reactivate (provider-confirmed) —');
const cancel = await req('POST', '/billing/cancel', { token: A.token });
ok('cancel scheduled at period end', cancel.json.cancelAtPeriodEnd === true && cancel.json.status === 'active');
const stripeSub = await stripe('GET', `/subscriptions/${cancel.json.stripeRef}`);
ok('Stripe agrees (cancel_at_period_end=true)', stripeSub.cancel_at_period_end === true);
const react = await req('POST', '/billing/reactivate', { token: A.token });
ok('reactivated', react.json.cancelAtPeriodEnd === false);

console.log('— Failed-payment scenario (separate tenant, failing test card) —');
const B = await mk('F');
await req('POST', '/billing/checkout', { token: B.token, body: { planKey: 'starter' } }); // creates the Stripe customer
const custB = (await req('GET', '/billing/overview', { token: B.token })).json.subscription?.stripeCustomerId;
await stripe('POST', `/payment_methods/pm_card_chargeCustomerFail/attach`, { customer: custB });
await stripe('POST', `/customers/${custB}`, { 'invoice_settings[default_payment_method]': 'pm_card_chargeCustomerFail' });
let failedSubId = null;
try {
  const failedSub = await stripe('POST', '/subscriptions', {
    customer: custB,
    'items[0][price]': priceOf('starter'),
    payment_behavior: 'allow_incomplete',
  });
  failedSubId = failedSub.id;
} catch (e) {
  console.log(`  (subscription create with failing card: ${String(e.message).slice(0, 100)})`);
}
const ovFailed = await pollOverview(B.token, (o) => ['past_due_grace', 'past_due_locked'].includes(o.state), 'past_due', 90_000);
ok('invoice.payment_failed → past-due with grace + warning', ['past_due_grace'].includes(ovFailed?.state) && (ovFailed?.warnings ?? []).some((w) => w.kind === 'past_due'), `state=${ovFailed?.state}`);
ok('failed payment recorded in billing audit', ((await req('GET', '/billing/events', { token: B.token })).json ?? []).some((e) => e.type === 'payment_failed'));

console.log('— Webhook reliability ledger —');
const deliveries = await req('GET', '/billing/webhook-deliveries', { token: A.token });
ok('stripe-billing deliveries recorded + processed', (deliveries.json ?? []).some((d) => d.provider === 'stripe-billing' && d.state === 'PROCESSED'));

console.log('— Stripe test-object cleanup —');
try {
  if (failedSubId) await stripe('DELETE', `/subscriptions/${failedSubId}`).catch(() => {});
  await stripe('DELETE', `/customers/${customerId}`); // cancels its subscriptions too (test mode)
  if (custB) await stripe('DELETE', `/customers/${custB}`);
  ok('test customers + subscriptions deleted at Stripe', true);
} catch (e) {
  ok('test customers + subscriptions deleted at Stripe', false, String(e.message).slice(0, 120));
}

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
