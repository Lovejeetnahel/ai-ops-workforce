# SOFILIC — Project Status & Constitution
*Read this file first in any new session, on any device. It is the single source of truth for where this project stands and the rules that govern it.*

Last updated: 2026-07-14

---

## 1. The Product Constitution (permanent, do not re-litigate)

1. **One product.** Never build separate software per industry. Industries only customize via templates/presets/optional apps.
2. **One feature = one home.** Never duplicate functionality across modules.
3. **Extend before creating.** Before any new page/module/nav item, ask: "Would a normal business owner expect to find this inside an existing module?" If yes, extend the existing module.
4. **New sidebar items require explicit approval.** The sidebar below is frozen.
5. **Apps are for optional capabilities only** (Field Operations, Inventory, Fleet, HR). Core functionality never moves into Apps.
6. **Simplicity wins** over more features.
7. **Modern UX over feature count** — fewer clicks, cleaner experience, not "because a competitor has it."
8. **AI should feel invisible** — helps inside existing workflows, no AI-only pages, except Voice AI (explicit flagship exception).
9. **Build depth, not width** — improve existing modules, don't keep adding modules.
10. **Every screen must justify its existence** — if it can be a tab inside another page, make it a tab.
11. **GoHighLevel is the benchmark, not the limit** — match feature coverage/workflow, never copy their UI/branding/weaknesses.
12. **Preserve working systems** — improve/simplify/refactor only with measurable benefit; never rebuild working backend for novelty.

Every future product proposal must explain how it follows these rules before implementation begins.

---

## 2. Frozen navigation (Rev-2) — do not change without explicit approval

```
Dashboard
CRM
Sales
Conversations
Voice AI          ← flagship
Marketing         (incl. Reputation)
Social Media      (incl. Brand Kit, Media Library)
Websites          (incl. Blog, Funnels, Forms, Domains, Widgets)
SEO
Automation        (Recipes + Workflows canvas + History, one nav item)
Payments          (incl. Documents/Contracts/Proposals/E-sign)
Apps              (optional: Field Operations, Inventory, Fleet, HR + Marketplace)
Settings
```
Dashboard absorbed Reports as tabs (Overview / Analytics / Reports / Custom Dashboards). Company Brain lives inside Voice AI → Knowledge, not Settings.

---

## 3. Current build status

**Phase 1 — App shell, navigation, design system: ✅ DONE**
**Phase 1.5 — Terminology cleanup, black-and-gold design system, full frontend redesign: ✅ DONE**
**Phase 2 — Dashboard real data wiring: ✅ DONE (2026-07-12)**

Phase 2 details:
- **Completed:** Main Dashboard is fully wired to live tenant data with the frozen Rev-2 tab structure (Overview / Analytics / Reports / Custom dashboards). Overview shows real KPI cards (leads today/7d, revenue this month with real month-over-month delta, open conversations + voice calls, pipeline value + open leads), a gold 30-day revenue trend chart (SVG, no chart library), a merged real recent-activity feed (leads, payments, completed jobs, conversations, AI agent runs), and a real needs-attention panel (urgent jobs, overdue invoices, pending approvals, overdue tasks) that links into the owning modules. Widgets for jobs, bookings, automation and AI appear only when the tenant actually has that data (`modules` flags) — no irrelevant or fabricated widgets. Analytics tab renders the existing `/analytics/dashboard/executive` KPIs + revenue series. Custom dashboards tab lists real saved dashboards from `/analytics/dashboards`.
- **Files changed:** `apps/api/src/enterprise/analytics/analytics.service.ts` (new `overview()` aggregate + `recentActivity()` — additive, no existing method touched), `apps/api/src/enterprise/analytics/analytics.controller.ts` (new `GET /analytics/overview`, STAFF role), `apps/web/lib/api.ts` (added `overview`, `savedDashboards`), `apps/web/app/(app)/dashboard/page.tsx` (rewritten page).
- **Real data sources:** Value Ledger (revenue, trend), Lead/Contact (leads, pipeline), Conversation (threads, voice calls), Booking, Job + JobApproval, Document (outstanding/overdue invoices), Activity (open/overdue tasks), AutomationRule + EventLog (automation activity), AgentTask (AI activity). All via the tenant-scoped fail-closed Prisma client — no raw queries, no schema changes, no new tables.
- **Verified:** `@aiow/config`+API+web builds pass (zero type/lint errors, all 28 routes); 16/16 existing jest tests pass; live end-to-end test against a real local Postgres(pgvector)+Redis stack — two tenants created via the real signup API, leads created via the real leads API, `GET /analytics/overview` returned correct numbers for tenant A while tenant B saw all zeros (tenant isolation confirmed) and unauthenticated requests got 403; dashboard rendered in headless Chromium with zero console errors, all tabs + trend chart verified visually, and /crm /sales /automation /payments /voice-ai /settings /conversations /apps all still return 200.
- **Honest remaining limitations:** Reports tab is still a placeholder (no exports/scheduled reports built); Custom dashboards tab is read-only (the API supports create, but there is no builder UI); month-over-month delta shows "No prior-month data" until a tenant has a prior month in the ledger; the trend chart needs ≥2 days of ledger history; recent activity is capped at the 10 newest events with no pagination; conversation metrics count threads, not individual messages.

What's real (wired to live backend) vs. honest-empty (structurally complete UI, no backend yet):

| Module | Status |
|---|---|
| Dashboard | ✅ Real (Overview KPIs, revenue trend, activity feed, needs-attention; Analytics tab real; Reports/Custom honest states) |
| CRM | ✅ Real (Companies, Tasks, Contacts-from-pipeline) |
| Sales | ✅ Real (pipeline board, follow-ups) |
| Automation | ✅ Real (Recipes + Workflows + History, live toggle) |
| Payments | ✅ Real (Invoices, Estimates, Transactions, Subscriptions) |
| Apps | ✅ Real (Field Operations jobs, Marketplace) |
| Voice AI | 🟡 Agents tab real; rest honest setup states (no backend yet) |
| Conversations, Marketing, Social, Websites, SEO | 🟡 Honest empty/setup states (no backend yet) |
| Settings | ✅ Real (business type, invite-user modal) |

**Phase 2 RELEASE — production domains + Docker hardening: ✅ DONE (2026-07-12, PR #1)**

Release details:
- **PR:** #1 (`claude/access-project-mobile-xyjkyh` → `main`). Final merged commit hash: recorded in git history of `main` (merge of PR #1).
- **Production domains (Caddy on host, ports 80/443):** `https://sofilic.com` → `127.0.0.1:3000` (web), `https://www.sofilic.com` → redirect to apex, `https://api.sofilic.com` → `127.0.0.1:4000` (api).
- **Env required on the server (`/opt/aiow/.env`) — real variable names, no new ones invented:** `NODE_ENV=production`, `WEB_PUBLIC_API_URL=https://api.sofilic.com` (inlined into the web client bundle at BUILD time — changing it requires `docker compose build web`, not a restart), `CORS_ORIGINS=https://sofilic.com,https://www.sofilic.com` (strict allowlist; API refuses to boot in production without it), plus the existing secrets: `JWT_SECRET` (32+ chars), `CREDENTIALS_ENCRYPTION_KEY` (64 hex), `DATABASE_URL`, `REDIS_URL`. Auth is pure Bearer-token: no cookie domain, no OAuth callbacks exist.
- **Docker security changes:** all published container ports now bind to `127.0.0.1` only (postgres 5432, redis 6379, api 4000, web 3000) — nothing is internet-reachable except through Caddy; container-to-container networking unchanged (service DNS names, not host ports); worker publishes no ports. `apps/web/Dockerfile` gained a `WEB_PUBLIC_API_URL` build ARG and compose forwards it — this fixes a real bug where the production web bundle silently baked in `http://localhost:4000`.
- **Verification performed:** compose config validates; lint + build + 16/16 tests pass; web bundle built with the production URL contains `api.sofilic.com` and zero `localhost:4000` references in client chunks; live CORS probe — `https://sofilic.com` and `https://www.sofilic.com` allowed, `https://evil.com` rejected (no allow-origin header); tenant isolation re-verified live (second tenant still sees zero foreign data); no secrets in the committed diff (`.env` stays gitignored); GitHub Actions green.
- **Honest remaining limitations:** local-dev compose still uses the default `aiow/aiow` Postgres credentials — fine on loopback, but a strong `POSTGRES_PASSWORD` + matching `DATABASE_URL` on the server is recommended as a follow-up (changing it is a stateful operation and was out of scope for this release); Caddy itself is configured on the host, outside this repo; no staging environment yet; error tracking (Sentry-class) still not wired.
- **Deployment:** see `docs/DEPLOYMENT.md` → "Production domains" + the Termius block in the release notes: backup tag → `git pull` → set env → `docker compose build api worker web` → `docker compose up -d` → health checks.
- **Rollback:** `git checkout <previous-tag-or-hash> && docker compose build api worker web && docker compose up -d` (database untouched — this release contains no migrations).

**Next phase: ⏸ NOT DEFINED / NOT APPROVED.** Strong candidates per the Constitution ("wire, don't build"): Conversations backend wiring (real thread/message backend exists) or Voice AI beyond the Agents tab. The user must explicitly choose and approve the next phase in a session — this file being read is not itself approval.

---

## 4. Known repo facts (avoid re-discovering these every session)

- Repo: `https://github.com/Lovejeetnahel/ai-ops-workforce` (branch `main`)
- Apps: `apps/api` (NestJS), `apps/web` (Next.js 14, App Router), `packages/config` (shared industry preset config)
- Deployed: Hetzner VPS via Docker Compose (see `PRODUCTION_PLAYBOOK.md`)
- Backend automation engine is real and two-tier: `automation` module (simple rules) + `enterprise/workflows` module (visual graph engine) — do not rebuild either, only surface them
- Legacy pre-Rev-2 routes (pipeline, inbox, workforce, revenue, billing, reviews, automations, workflows, marketplace, dispatch, jobs, analytics, executive) are **deleted** — their content was ported into the new Rev-2 routes, and `next.config.js` redirects the old paths
- Design system: black-and-gold (`--indigo`/`--blue` = `#ffc629`, `--violet` = `#e8a317`, `--cyan` = `#ffe066`), defined in `apps/web/app/globals.css`
- Other docs in repo root are **historical/superseded strategy** (kept for reference, not active roadmap): `SOFILIC_PRODUCT_STRATEGY.md`, `SOFILIC_INDUSTRY_WORKSPACE_BLUEPRINT.md`, `SOFILIC_PRODUCT_AUDIT_AND_MASTER_ROADMAP.md`, `SOFILIC_GHL_PIVOT_AUDIT.md`, `SOFILIC_KNOWLEDGE_TRANSFER.md`. **This file (`SOFILIC_STATUS.md`) supersedes them for current direction** — the GHL-model pivot + Product Constitution + Rev-2 structure is the live plan.

---

## 5. How to resume work in a new session (any device)

1. `git pull origin main` first, always.
2. Tell Claude: *"Read SOFILIC_STATUS.md and continue from there."*
3. State what you want to do next. If it's a new phase or new nav item, Claude should ask for confirmation per the Constitution — that's expected, not a bug.
4. At the end of a working session, ask Claude to update Section 3 of this file before you stop, so the next session (any device) picks up accurately.

---

## 6. Public website releases

**This is separate from the Phase numbering in Section 3** — Phase 2 (the authenticated product) is deployed and unaffected by this work. Website releases only touch the public marketing site (`apps/web/app/(public)/*`) plus one small, isolated, additive backend module for the Contact form.

### Website Release 1 — Trust, Accuracy and Consistency: ✅ APPROVED IN PRINCIPLE, FINAL REVIEW DONE (2026-07-14)

- **Branch:** `website/release-1-trust-accuracy` (from latest `main` post-Phase-2-deploy).
- **PR:** [#3](https://github.com/Lovejeetnahel/ai-ops-workforce/pull/3) — `Public Website Release 1 — Trust, Accuracy and Consistency`. Merge status/final commit: see the top of this section once merged (this file is updated again immediately after merge in the same session).
- **Deployment:** NOT deployed to production yet — merging `main` does not auto-deploy; deployment to the Hetzner VPS is a separate, explicit step (see the Termius block issued alongside the merge).

**Files changed:**
- New: `apps/web/lib/product-status.ts` (the single source of truth for Live/Beta/Limited/Coming-soon claims), `apps/web/components/StatusBadge.tsx`, `apps/web/app/(public)/{contact,support,security,privacy,terms}/*`, `apps/web/app/(public)/{login,signup}/layout.tsx` (per-route metadata for the two client-component auth pages), `apps/api/src/public/*` (Contact form module: controller, service, IP-based rate-limit guard), `apps/api/prisma/migrations/20260714144617_add_public_contact_submission/`.
- Modified: `apps/web/app/(public)/{page,features,industries,pricing,demo,resources,signup,layout}.tsx`, `apps/web/app/layout.tsx`, `apps/web/app/globals.css` (additive classes only), `apps/web/lib/api.ts` (added `contactUs`), `apps/api/prisma/schema.prisma` (new `PublicContactSubmission` global model), `apps/api/src/common/prisma/prisma.service.ts` (registered the new model as tenant-agnostic), `apps/api/src/app.module.ts` (registered `PublicModule`), `apps/api/src/health.controller.ts` (service name only).

**Product-status source created:** `apps/web/lib/product-status.ts` defines `MODULE_STATUS`, `INTEGRATION_STATUS`, and `industryStatusList()` (which reads live from `@aiow/config`'s `listPresets()` — never a hand-maintained duplicate). The Homepage, Features, Industries and Pricing pages all consume this instead of hardcoding their own claims.

**Claims removed or corrected:**
- Fake customer logo row and three fabricated named testimonials (Rachel N., Devon M., Aisha S.) — replaced with explicitly-labeled fictional "Example scenarios."
- Unverifiable performance claim ("90 sec missed call → booked job") — removed everywhere it appeared (homepage, demo page).
- Absolute claims ("never drifts", implied GDPR/PIPEDA certification) — reworded to describe what's actually built, with an explicit "we do not hold a formal compliance certification today" disclaimer on the new Security page.
- Mock dashboard preview numbers on the homepage — now carry a visible "Example data — not a real customer account" flag.
- Demo page renamed in nav/metadata to "Example Workflow"; copy now explicitly says it's fictional and that automated call-answering is beta, not a recording of a real call.
- Features page hero claim "no add-on modules, no per-feature pricing surprises" — removed (it directly contradicted the Pricing page's add-ons section).
- Corrected two real overclaims found only by reading the actual frontend code, not docs: "Customer Portal" was claimed live but the in-app page is explicitly self-labeled "Preview" with only empty states (now Beta); "Notifications", "Dispatch", "Scheduling" and "Executive Briefing" have real backend endpoints but zero frontend surface in the shipped Rev-2 app (now Coming soon, not Live).
- "Talk Enterprise" / "Talk to Enterprise" now links to `/contact`, not back to `/pricing`.
- Industries page and the signup form's industry dropdown both now render from the exact same `listPresets()` call — both show 17, verified live in a browser in the same session (previously the signup page had a second hand-maintained 17-row duplicate array that could have drifted).

**Legal and trust pages added:** `/privacy`, `/terms`, `/contact`, `/support`, `/security` — all real routes, linked consistently in the footer of every public page. No company legal entity name, registered address, jurisdiction, phone number, or compliance certification is asserted anywhere — a repo-wide search found none on file, so none were invented; Privacy/Terms explicitly note these will be added once finalized and direct all requests to the Contact form.

**Contact implementation:** `POST /api/public/contact` — a new, additive, unauthenticated endpoint (mirrors the existing public-signup convention in `TenantsController`, so no new auth pattern was introduced). Validates input via the existing global `ValidationPipe` (`whitelist` + `forbidNonWhitelisted`), rate-limits by IP (5/min, fixed-window via Redis, fails open on a Redis outage — same technique as the existing `ApiScopeGuard`), and has a honeypot field (`website`) that returns a fake success without writing anything if filled. Storage is a new tenant-agnostic `PublicContactSubmission` model (a prospect has no tenant yet) — accessed via the base Prisma client, the same convention already used for `Tenant`/`Message`/`Organization`. Only a SHA-256 hash of the submitting IP is kept, never the raw IP. No tenant data is touched or exposed.

**Pricing corrections:** kept the existing five-tier structure and price points (no current, non-superseded source of truth mandates a different model). Fixed internal consistency: currency (USD) and billing period (monthly) are now stated explicitly; "Is there a free trial?" no longer invents an unbounded free trial — it accurately describes no-card-required signup plus the real 14-day trial that begins when a paid plan is chosen (`Subscription.trialEndsAt` in `billing.service.ts`); removed fabricated per-addon dollar amounts (Voice minutes $0.20/min, Reviews Pro $49/mo, Marketing Pro $49/mo, Website $29/mo) that existed nowhere in the actual billing config — beta/coming-soon add-ons now say "Pricing to be confirmed" instead of guessing; no refund policy, annual discount or tax handling is asserted (none exists in any approved source).

**Industry corrections:** the public Industries page now derives its count and cards directly from `listPresets()` (17 total: 14 field-service trades + General Field Services + Real Estate + Professional Services), matching the signup form exactly by construction. Added a plain-language "Engines, presets and universal workspaces" explainer per the Constitution's "one product" principle, so the page doesn't imply 17 separately-built apps.

**Integration-status corrections:** Stripe, Twilio, SendGrid and the Public API are shown Live (own-account connection required); Vapi Voice is Beta; Google Calendar, QuickBooks/Xero, social platforms and Zapier/webhooks are Coming soon — all driven from `INTEGRATION_STATUS` in the new config file, shown on the Features page (not duplicated on the homepage).

### Final release review additions (2026-07-14, same day, before merge)

- **Legal-page copy fixed:** Privacy and Terms were rewritten to remove internal-development phrasing ("no legal entity exists," "founder has not supplied this," "missing from the repository"). They now read as professional, neutral policy documents that refer to the service as "Sofilic" throughout, cover every requested section (Privacy: information collected, account/business info, contact submissions, product usage, service providers, data security, retention, user requests, policy updates, contact method; Terms: service access, account responsibility, acceptable use, subscription/pricing, beta/coming-soon functionality, intellectual property, service availability, suspension/termination, contact method), and close with a plain statement that neither page is legal advice or a compliance certification. **No legal entity name, address, jurisdiction, registration number, phone number or certification is invented anywhere** — none exists in the repo, so the pages simply never assert one, rather than drawing attention to the gap.
- **Pricing wording fixed:** "Pricing to be confirmed" replaced with the specific professional phrasing requested — "Available during beta" (Voice AI minutes), "Pricing to be announced" (Reviews, Marketing, Website builder — all Coming soon), plus "Contact us for current availability" in the section intro. No "TBD" anywhere. Every plan card now visually separates **Plan limits** (staff users / AI employee role count, shown as a tag) from **Included features**, **In beta** features and **Coming soon** features (each of the latter two with its own labeled subsection and `StatusBadge`), instead of parenthetical inline text.
- **Contact-submission retrieval added:** inspected the RBAC architecture first — every `User`/role (`CUSTOMER`/`STAFF`/`ADMIN`/`OWNER`) belongs to exactly one tenant, and `RolesGuard` only ever ranks within that tenant's context; there is **no cross-tenant "platform admin" concept anywhere in this product today** (confirmed by reading `ops.controller.ts`'s existing `@Roles('ADMIN')` metrics endpoint, which is itself tenant-scoped). Since `PublicContactSubmission` belongs to no tenant, no tenant JWT — not even an OWNER's — is a meaningful authorization for it. Added the smallest safe additive solution: `GET/PATCH /api/admin/contact/submissions`, gated by a new `AdminTokenGuard` checking a shared secret (`ADMIN_API_TOKEN`, required in production, constant-time compared) sent as `X-Admin-Token` — not a tenant session. Returns a paginated list (date, name, email, company, topic, status, message; **no IP hash or other technical metadata**) and supports a status update (`NEW`/`READ`/`RESOLVED`). No public listing endpoint exists. Live-verified: correct token succeeds; missing/wrong token → 401; a real tenant OWNER's JWT → 401 (proving zero overlap with tenant RBAC); pagination works; invalid status value → 400.
- **Migration safety re-verified:** the new `status` column (migration `20260714151450_add_contact_submission_status`) triggered the **exact same** Prisma auto-drop of both pgvector HNSW indexes as the previous migration. Caught again, hand-fixed to be purely additive, and re-verified via a full local `prisma migrate reset --force` (replays all 4 migrations from an empty database) followed by `prisma migrate deploy` (the real production command) — both HNSW indexes and the `PublicContactSubmission` table are confirmed intact afterward. A permanent, detailed warning about this recurring hazard — including the exact fix procedure — is now in `docs/DEPLOYMENT.md` under "Zero-downtime migrations," so it's discoverable before a third occurrence. **No rollback migration was written**; the standing rollback approach (below) is to redeploy the previous code/image, matching this repo's existing forward-only migration philosophy — the additive `status` column and `PublicContactSubmission` table are harmless to leave in place even if the application code is rolled back.
- **Full public-site re-audit (13 pages):** re-verified zero fake testimonials/customers, zero unsupported performance stats, zero dead links (every internal `href` across all public pages resolves to a real route), 13/13 unique page titles (no duplicates), zero `localhost` URLs, zero old "aiow" text in any user-visible copy (the only remaining `aiow` strings are the internal `@aiow/config` package import and the pre-existing `aiow_token`/`aiow_user` localStorage key names — invisible technical identifiers, not public branding; renaming them would be an unrelated, riskier refactor touching the whole app, out of scope), zero unverified compliance claims, no contradictions between Pricing/Features/Industries/Signup (industries count is 17 everywhere, derived from one source), sample data visibly labeled, Live/Beta/Coming-soon consistent everywhere.

**Migration files and production command:**
- `apps/api/prisma/migrations/20260714144617_add_public_contact_submission/migration.sql` — creates `PublicContactSubmission`.
- `apps/api/prisma/migrations/20260714151450_add_contact_submission_status/migration.sql` — adds the `ContactSubmissionStatus` enum and `status` column.
- Production command (unchanged from every prior release): `pnpm --filter @aiow/api exec prisma migrate deploy` — this is also what the API container runs on boot.

**Verification performed (both review rounds combined):** `@aiow/config` + API + web builds clean (33 public+app routes total, zero type errors); 16/16 existing jest tests pass; a real local Postgres(pgvector)+Redis stack — both new migrations generated, both caught mid-generation trying to drop the pgvector HNSW indexes, both hand-fixed, then verified with a full `prisma migrate reset` + `migrate deploy` replay that the final committed migrations are purely additive and the indexes survive intact; live contact-form tests via both the raw API and the real browser UI (happy path stored and shows a real "Message sent" success screen, honeypot path returns success but writes nothing, invalid email blocked by both server-side 400 and client-side HTML5 validation, missing/unexpected field → 400, rate limit trips at 5/min and recovers); live admin-endpoint tests (correct token succeeds, missing/wrong token 401s, a real tenant OWNER's JWT is rejected, pagination works, status update works, invalid status 400s, no IP hash leaked in the response); tenant isolation re-verified live twice (two different tenant pairs across the two review rounds, second tenant always sees zero foreign data); headless-browser pass over all 13 public pages plus a representative mobile-viewport pass — zero console errors, zero failed requests, 13/13 unique titles; authenticated app re-verified twice — `/dashboard /crm /sales /automation /payments /voice-ai /settings /conversations /apps` all still 200 with zero console errors; confirmed no secrets in either diff; confirmed the health endpoint returns `sofilic-api`; GitHub Actions green on the final commit before merge.

**Honest remaining limitations:**
- The Resources page is intentionally small (6 real links) rather than a full guide/documentation library — there isn't one yet.
- Privacy/Terms deliberately do not name a legal entity, address or jurisdiction — none exists anywhere in the repo today; a founder needs to supply this before it's legally complete. The pages are written so this can be added later without sounding like a retrofit.
- Contact submissions have a real retrieval path (`GET/PATCH /api/admin/contact/submissions` with `ADMIN_API_TOKEN`) but no in-app inbox UI — triage happens via API call (e.g., `curl`) today, not a page in the product. Building a UI for this was deliberately not done, since any new page would need to live somewhere in the app without becoming an unapproved new Rev-2 sidebar item — a bigger decision than this release's scope.
- Add-on pricing for beta/coming-soon capabilities (Voice minutes, Reviews, Marketing, Websites) is explicitly marked "Available during beta" / "Pricing to be announced" — a real founder decision, not something to invent.
- `ADMIN_API_TOKEN` is a new required-in-production environment variable — **the API will refuse to boot without it** once this release is deployed. It must be generated and added to the server's `.env` before the deploy's rebuild step (see the Termius block).
- The pgvector-HNSW-index-drop hazard (below) is a standing risk for any future `prisma migrate dev` run on this schema, by anyone, not specific to this release.

**Exact next website release:** not defined or approved. Do not begin "Website Release 2" or any product-phase work (Phase 3) without the founder explicitly choosing and approving it in a session — this file being read is not itself approval.
