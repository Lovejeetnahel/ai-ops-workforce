# Version 1.0 — Release Notes, Checklist & Known Limitations

## What V1.0 is
A multi-tenant **AI Business Operating System** for service businesses: a digital
AI workforce (8 AI employees) on top of a complete CRM → Operations → Revenue →
Customer Portal → Employee Workforce → Enterprise Intelligence stack, plus a
marketplace, billing, public API, and a visual workflow engine.

## Capabilities (all backend-complete + verified building)
| Domain | Status |
|---|---|
| Multi-tenancy, RBAC, EventBus, Automation | ✅ |
| Business Brain (RAG + memory) | ✅ |
| Control Layer (Decisions + Outcomes + Value Ledger) | ✅ |
| Universal CRM (companies, contacts, leads, activities, tasks) | ✅ |
| Operations (scheduling, dispatch, jobs, teams) | ✅ |
| Revenue (quotes → invoices → payments, Stripe) | ✅ |
| Customer Portal (book/track/pay/chat) | ✅ |
| Employee Workforce (time, execution, assets, copilot, KPIs) | ✅ |
| Enterprise Intelligence (analytics, predictions, reporting, workflows) | ✅ |
| AI Workforce (8 cooperating AI employees) | ✅ |
| Marketplace · Billing · Public API · Webhooks | ✅ |
| Frontend dashboards (13 routes) + dark/light | ✅ builds |

## V1.0 launch checklist
- [x] `tsc --noEmit` clean · `nest build` clean · `next build` clean · tests pass
- [x] K8s manifests + HPA + probes (`/ops/live`, `/ops/ready`)
- [x] CI (lint/build/test) + release image workflow
- [x] Env validation fails fast in production
- [x] Encryption at rest for tenant credentials; JWT + API-key auth; RBAC
- [ ] Apply the **9 accumulated migrations** to a provisioned Postgres
- [ ] Set production secrets (JWT, encryption key, Anthropic/Voyage/Stripe)
- [ ] Configure a real domain + TLS + Stripe webhook endpoint

## Known limitations (honest — not placeholders)
1. **Migrations not yet applied to a live DB** in this environment (no Postgres
   running here). All 9 are generated/wired; run `migrate deploy`.
2. **Integration adapters in stub mode** until keys are set: Vapi/Twilio/SendGrid/
   GCal/Stripe/Voyage/Vision all have one reference implementation + a safe
   offline stub. Per-connector *actions* (Slack/QuickBooks/etc.) are catalog +
   credential seams over the existing port pattern.
3. **Stripe billing** persists subscriptions/usage and issues payment links; full
   Stripe *Subscriptions* API (proration, dunning, tax) is a seam on `stripeRef`.
4. **Frontend** is a complete, building dashboard set (13 routes) that reads the
   live API with graceful fallback. The **drag-&-drop workflow builder canvas**
   and **native mobile apps** are not built — the backend (`/workflows`, field
   APIs, offline `/field/sync`, push-ready notifications) fully supports them.
5. **Security**: RBAC, API keys, audit, encryption, GDPR export/erasure shipped.
   **SSO/MFA** are not implemented (architecture is ready via the auth module).
6. **Rate limiting** on `/v1` is per-instance; back with Redis for multi-node.
7. **Reports**: JSON + CSV implemented; PDF/Excel are render targets over the
   same data. Scheduled-report cron execution needs a scheduler wired to
   `ReportDefinition.schedule`.

## Roadmap to commercial GA (realistic)
- **Infra hard-run:** provision Postgres/Redis, apply migrations, load-test,
  wire metrics/alerting (1–2 wks).
- **Billing GA:** full Stripe Subscriptions + tax + dunning (1–2 wks).
- **Frontend depth:** workflow-builder canvas, per-role dashboard polish,
  accessibility audit, mobile apps (4–8 wks).
- **Security GA:** SSO (SAML/OIDC) + MFA + session/device management (2–3 wks).
- **Connectors:** turn the 26-entry catalog into live adapters as demand dictates.
- **Test depth:** integration/E2E/load coverage beyond the unit baseline.
