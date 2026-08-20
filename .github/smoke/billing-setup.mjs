/**
 * Stripe billing provisioning (runs on the GitHub Actions runner).
 * Reads STRIPE_BILLING_SECRET_KEY from the environment (a GitHub Actions
 * secret — masked in logs, never committed, never echoed by this script).
 *
 * Idempotently ensures, in the key's OWN mode (test or live):
 *  • three Products + monthly recurring Prices matching the REAL Sofilic plan
 *    catalog exactly (starter $99 / pro $299 / enterprise $999 — the enforced
 *    catalog in apps/api/src/common/entitlements/plans.ts, no invented prices)
 *  • one webhook endpoint at https://api.sofilic.com/api/webhooks/billing with
 *    exactly the events the API handles
 *
 * SAFETY: refuses a LIVE-mode key unless ALLOW_LIVE=true is explicitly set.
 * OUTPUT: price ids + endpoint id (not secrets) to stdout and $GITHUB_ENV;
 * the webhook SIGNING SECRET goes to $GITHUB_ENV only, after ::add-mask::.
 */
import { appendFileSync } from 'node:fs';

// .trim(): pasted GitHub secrets often carry a stray leading/trailing newline.
const KEY = (process.env.STRIPE_BILLING_SECRET_KEY ?? '').trim();
const ALLOW_LIVE = process.env.ALLOW_LIVE === 'true';
const WEBHOOK_URL = 'https://api.sofilic.com/api/webhooks/billing';

// The real plan catalog — MUST stay in lockstep with plans.ts.
const PLANS = [
  { key: 'starter', name: 'Sofilic Starter', amount: 9900 },
  { key: 'pro', name: 'Sofilic Pro', amount: 29900 },
  { key: 'enterprise', name: 'Sofilic Enterprise', amount: 99900 },
];

if (!KEY) { console.error('STRIPE_BILLING_SECRET_KEY is not set (GitHub secret missing)'); process.exit(1); }
const isTest = /^(sk|rk)_test_/.test(KEY);
const isLive = /^(sk|rk)_live_/.test(KEY);
if (!isTest && !isLive) { console.error('Key does not look like a Stripe secret/restricted key'); process.exit(1); }
if (isLive && !ALLOW_LIVE) {
  console.error('REFUSED: this is a LIVE-mode key and allow_live was not set. Test mode must be proven first (founder rule).');
  process.exit(1);
}
console.log(`Stripe key mode: ${isTest ? 'TEST' : 'LIVE (explicitly allowed)'}`);

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

function ghEnv(name, value) {
  if (process.env.GITHUB_ENV) appendFileSync(process.env.GITHUB_ENV, `${name}=${value}\n`);
}

// ── Products + monthly prices (idempotent via metadata.sofilic_plan) ──
const priceIds = {};
for (const plan of PLANS) {
  const products = await stripe('GET', `/products/search?query=${encodeURIComponent(`metadata['sofilic_plan']:'${plan.key}'`)}`);
  let product = products.data?.[0];
  if (!product) {
    product = await stripe('POST', '/products', { name: plan.name, 'metadata[sofilic_plan]': plan.key });
    console.log(`created product ${plan.key}: ${product.id}`);
  } else console.log(`product ${plan.key} exists: ${product.id}`);

  const prices = await stripe('GET', `/prices?product=${product.id}&active=true&limit=10`);
  let price = (prices.data ?? []).find(
    (p) => p.unit_amount === plan.amount && p.currency === 'usd' && p.recurring?.interval === 'month',
  );
  if (!price) {
    price = await stripe('POST', '/prices', {
      product: product.id,
      unit_amount: String(plan.amount),
      currency: 'usd',
      'recurring[interval]': 'month',
      'metadata[sofilic_plan]': plan.key,
    });
    console.log(`created price ${plan.key}: ${price.id} ($${plan.amount / 100}/mo)`);
  } else console.log(`price ${plan.key} exists: ${price.id} ($${plan.amount / 100}/mo)`);
  priceIds[plan.key] = price.id;
}

// ── Webhook endpoint: recreate for our URL so the signing secret (returned
//    only at creation) is captured fresh and written to production this run. ──
const endpoints = await stripe('GET', '/webhook_endpoints?limit=100');
for (const ep of endpoints.data ?? []) {
  if (ep.url === WEBHOOK_URL) {
    await stripe('DELETE', `/webhook_endpoints/${ep.id}`);
    console.log(`replaced existing webhook endpoint ${ep.id}`);
  }
}
const endpoint = await stripe('POST', '/webhook_endpoints', {
  url: WEBHOOK_URL,
  'enabled_events[0]': 'checkout.session.completed',
  'enabled_events[1]': 'customer.subscription.created',
  'enabled_events[2]': 'customer.subscription.updated',
  'enabled_events[3]': 'customer.subscription.deleted',
  'enabled_events[4]': 'invoice.paid',
  'enabled_events[5]': 'invoice.payment_failed',
  description: 'Sofilic SaaS billing (managed by deploy pipeline)',
});
console.log(`webhook endpoint: ${endpoint.id} → ${WEBHOOK_URL}`);

// Mask the signing secret BEFORE it touches any env file, then hand everything
// to later steps via GITHUB_ENV. The secret is never printed.
console.log(`::add-mask::${endpoint.secret}`);
ghEnv('SETUP_WEBHOOK_SECRET', endpoint.secret);
ghEnv('SETUP_PRICE_STARTER', priceIds.starter);
ghEnv('SETUP_PRICE_PRO', priceIds.pro);
ghEnv('SETUP_PRICE_ENTERPRISE', priceIds.enterprise);
ghEnv('SETUP_BILLING_MODE', isTest ? 'test' : 'live');
console.log(`SETUP_OK mode=${isTest ? 'test' : 'live'} prices=${priceIds.starter},${priceIds.pro},${priceIds.enterprise}`);
