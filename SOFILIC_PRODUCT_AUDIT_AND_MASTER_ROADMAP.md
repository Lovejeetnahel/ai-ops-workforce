# SOFILIC — Product Audit & Master Roadmap
### The 2–3 year plan to become the world's best Business OS for local businesses
*Founder / Product / UX / CTO / CEO composite review — July 2026*
*Companions: SOFILIC_PRODUCT_STRATEGY.md · SOFILIC_INDUSTRY_WORKSPACE_BLUEPRINT.md*

---

# SECTION 0 — HONEST STATE OF THE PLATFORM

The audit only works if we tell ourselves the truth. Sofilic today is **a real, deployed multi-tenant backend with genuinely differentiated bones — wearing a premium UI in which several rooms are staged furniture.** That staging was correct for speed; converting staged rooms into load-bearing ones is the single biggest theme of the next six months.

### What is REAL and strong (the moat we build on)
| Area | State |
|---|---|
| Multi-tenant core (fail-closed isolation, RBAC, JWT/refresh, audit, encrypted creds) | ✅ Production-grade; certified in live security passes |
| Payments integrity (CAS settlement, value ledger, idempotent webhooks, sweep) | ✅ Genuinely better than most incumbents |
| Generic data model + engine/preset config system | ✅ The scaling mechanism works (Phase 1 shipped on it) |
| AI workforce framework + leaderboard + Executive briefing | ✅ Wired to real endpoints |
| Automation engine (rules, presets, advisory-locked concurrency) | ✅ Real |
| Scheduling (working hours, conflict-free slots, calendar, booking) | ✅ Real backend, thin UI |
| Field app APIs (time, movement, copilot, analytics) | ✅ Real backend |
| Omnichannel backend (threads: voice/SMS/chat/email) | ✅ Real backend, **no UI wiring** |
| Public /v1 API with scoped keys + rate limiting | ✅ Real, **no self-serve keys UI** |
| Deployment (Docker/compose, Hetzner, migrations, playbook) | ✅ Live |

### What is STAGED (premium UI over demo data — must be wired)
Dashboard KPIs/widgets · Dispatch board · Revenue invoices table · Workflows runs · Field Team page · Customer Portal page · Notifications · Automations page (hardcoded rules while a real rules engine sits in the backend!) · Reviews · Inbox · Marketing Studio · most of Settings.

### What is MISSING entirely (no backend, no UI)
Public booking page · plan checkout (Billing "Choose" buttons do nothing) · staff-invite UI (endpoint exists!) · forgot-password / email verification / 2FA · onboarding wizard & product tour · global search / ⌘K · file & photo upload anywhere · real notification feed · mobile apps · offline field mode · GPS capture UI · API-keys self-serve UI · audit-log viewer · data-export UI · webhooks management UI · CI pipeline · error tracking (Sentry) · staging environment discipline · feature flags · per-tenant demo-data toggle.

**Founding insight of this audit:** our fastest path to "world-class product" is not new surface area. It is (1) wiring every staged surface to the real backend it already has, (2) closing the ~10 table-stakes gaps above, then (3) compounding the AI advantage nobody else has. Roughly 60% of H1 is "make truth out of the demo."

---

# SECTION 1 — PLATFORM-WIDE AUDIT

## 1.1 Missing (highest-impact absences)
1. **Dashboard aggregation API.** The command center invents its numbers. One `GET /dashboard/summary` composing value-ledger, pipeline, jobs, automations — every widget becomes real in one endpoint.
2. **Public booking page** (`book.sofilic.com/{slug}`). The single most-requested artifact for every industry; also our viral loop (footer: "Powered by Sofilic").
3. **Onboarding wizard.** After signup a user lands on a dashboard full of someone else's demo numbers with no path. First-hour experience decides churn.
4. **Demo-data-vs-empty-state discipline.** New tenants should get a *labeled* "sample mode" they can clear — right now demo data and real data are indistinguishable, which destroys trust the moment an owner notices.
5. **Money loop closure.** Plans page can't actually charge (no Stripe Checkout wiring); invoices UI can't create an invoice. We literally cannot take a customer's money without the API.
6. **Team loop closure.** `POST /tenants/users` exists; there is no UI to invite a technician. The entire field-app story is dead on arrival for a real signup.
7. **Password recovery.** A B2B product without "forgot password" loses accounts weekly.
8. **File/photo pipeline.** Jobs without before/after photos, quotes without attachments, no S3/R2 integration. Photos are the #1 emotional artifact in every trade.
9. **Search.** No way to find a customer by name across the app. ⌘K palette + typeahead is table stakes for "OS" claims.
10. **Mobile.** Field staff live on phones. Responsive web is not a field tool: offline, GPS, camera, push are not optional for the DISPATCH engine long-term.

## 1.2 Weak
- **Notifications** page is static; the backend event system could feed a real feed + badge counts today.
- **Settings** is a grid of descriptions, not controls (no business hours editor, no branding upload, no integration connect flows).
- **Analytics** shows six KPIs and one bar row; no date-range control, no drill-down, no export.
- **Automations UI** shows four hardcoded rules while the real rules engine (with per-industry presets already seeded per tenant!) goes un-surfaced. Highest wiring ROI in the app.
- **Pipeline** lacks drag-and-drop, filters, per-card detail drawer, and activity history.
- **AI Workforce** lists employees but offers no run history, no approval queue for APPROVE-authority agents, no per-employee settings.

## 1.3 Confusing
- **Workflows vs Automations** as sibling nav items reads as duplication (blueprint already resolves: one item, "Runs" tab).
- **Revenue vs Billing vs Analytics** triangle: owner revenue, our subscription, and metrics are three different things wearing similar words. Rename Billing → "Plan & Billing" under Manage; Revenue stays owner-facing.
- **Portal page inside the owner app** renders a *customer's* view without explanation — needs an "as your customer sees it" preview frame.
- **Executive Briefing vs Dashboard hero** both claim "what should I do today."  Merge: hero shows briefing headline; page holds the deep brief.

## 1.4 Duplicated / inconsistent
- Two sets of KPI card markup (dashboard vs analytics) with different delta styling.
- Badge/chip/tag: three overlapping label components used interchangeably — pick semantics (status=chip, meta=tag, context=badge) and enforce.
- Date display: "2h ago" vs "10:30 AM" vs ISO in different panels.
- Currency formatting inconsistent ($4,820 vs $240 vs 48200).

## 1.5 Outdated / not premium
- Marketing site sections still say "12 modules," not the 42-industry story Phase 1 shipped.
- Emoji as icons was right for speed; a consistent stroke-icon set is the single cheapest "premium" upgrade remaining.
- No favicon-quality logo usage in portal/emails; transactional emails (if any fire) are unbranded.
- No motion discipline: fade-up exists but page-to-page transitions, list reordering, and number count-ups are absent.

## 1.6 Time & money left on the table (platform level)
- **Payments take-rate.** Jobber/HCP monetize payments heavily. Sofilic Payments (embedded Stripe Connect w/ margin) is likely our **largest untapped revenue line** — bigger than any workspace add-on.
- **AI answering usage pricing** is designed but not metered anywhere.
- **Annual plans** don't exist; local businesses prepay annual for discounts readily.
- **Referral loop** ("Powered by Sofilic" on booking pages, portals, review requests, invoices) — zero cost distribution not yet wired.

---

# SECTION 2 — ENGINE-BY-ENGINE AUDIT

Format per engine: **Missing → Pay-more triggers → Unsolved daily problems → Should be automatic → AI should → Missing reports → Missing workflows → Missing integrations.**

## 2.1 Field Service (live)
- **Missing:** job photos/attachments; drag-drop dispatch board wired to real jobs; maintenance/service agreements as first-class recurring objects; parts on quotes; multi-day/crew jobs; customer-visible tech ETA ("Uber view"); price book.
- **Pay more for:** consumer financing at quote (huge ticket-lift), maintenance-plan billing engine, "good/better/best" quote presentation (proven +30% ticket), payments with same-day payout.
- **Unsolved daily:** "where is everyone right now" live map; end-of-day reconciliation (jobs done vs invoiced vs paid — one screen); callback tracking (warranty rework eats margin invisibly).
- **Automatic:** invoice creation on job completion; deposit collection on booking; permit checklist attach by job type; weather rescheduling proposals.
- **AI should:** price-book-aware quote drafting from photos; dispatch suggestions with reasons ("Tina: closest + certified + free at 2"); end-of-day owner digest; churn-risk flag on maintenance customers.
- **Missing reports:** revenue per tech per day; quote win-rate by service type; callback rate; response-time SLA; membership penetration.
- **Missing workflows:** estimate→deposit→schedule chain; parts-arrival→auto-offer return slot (designed, unwired); post-install warranty registration.
- **Missing integrations:** QuickBooks/Xero sync (deal-breaker frequency: high), Google Local Services Ads lead ingestion, supplier catalogs (Ferguson-style) later, Wisetack/financing.

## 2.2 Appointment (Phase 2 — building next)
- **Missing (design-in from day 1):** resources (chair/room/bay), service-duration matrix per provider, deposits & no-show fees, waitlist, group/class capacity, gift cards, packages/series, POS-lite checkout w/ tips, walk-in queue.
- **Pay more for:** no-show protection (card-on-file + fee automation) — this alone sells; memberships engine; smart waitlist that fills cancellations in minutes.
- **Unsolved daily:** double-booking fear; "quiet Tuesday" revenue holes; rebooking discipline.
- **Automatic:** reminder cascades; cancellation→waitlist backfill; rebook prompt timed to service cycle; birthday/anniversary touches.
- **AI should:** answer the phone and book against real availability (the moat); predict no-shows and require deposits selectively; draft service-cycle campaigns.
- **Reports:** utilization by provider/resource; rebook rate; no-show economics; package liability.
- **Integrations:** Google Reserve, Instagram/Facebook booking buttons, Apple/Google wallet passes for appointments.

## 2.3 Coverage / Security (Phase 3)
- **Missing:** everything in blueprint Part 2 (sites, rosters, tours, checkpoints, DAR, incidents) plus: guard mobile mode with panic button; license/cert registry w/ expiry gates; client SLA definitions.
- **Pay more for:** payroll export that actually matches billable hours (bill-vs-pay reconciliation is their nightmare); client portal with live coverage proof; scheduling that respects certs/laws.
- **Automatic:** open-shift broadcast→claim; missed-checkpoint alerts; DAR compilation nightly.
- **AI should:** write DARs from checkpoint pings; structure incident reports from voice notes; forecast coverage gaps a week out.
- **Reports:** fill rate, incident heatmap by site, margin per contract, overtime leakage.
- **Integrations:** payroll (ADP/Gusto export first, API later), body-cam/lone-worker later.

## 2.4 Property / Facility (Phase 3)
- **Missing:** unit/lease/tenant objects; owner statements; rent ledger; vendor management with COI (insurance cert) tracking; inspection templates w/ photos.
- **Pay more for:** owner portal (retention weapon for PM firms); arrears automation; turn-board (make-ready workflow between tenants).
- **Automatic:** rent reminders/late fees per jurisdiction template; renewal offers at 90d; maintenance triage→dispatch.
- **AI should:** triage tenant requests (urgency+trade+photo); draft owner monthly narratives; predict renewals.
- **Reports:** delinquency aging, days-to-fill, maintenance cost/unit, owner ROI statements.
- **Integrations:** rent payment rails (ACH), listing syndication later, smart locks later.

## 2.5 Case / Professional Services (Phase 3)
- **Missing:** time entries, retainer ledger, deadline engine w/ court-date semantics, doc-request portal, conflict check.
- **Pay more for:** "client stops calling for updates" (auto status portal + AI summaries); realization analytics; e-sign included (kill the DocuSign line item).
- **Automatic:** doc chasing; retainer replenishment; deadline cascades w/ escalation.
- **AI should:** first-draft documents from matter context; time-entry capture from calendar/email/calls; summarize matter for the client weekly.
- **Reports:** realization/utilization, WIP aging, doc bottleneck by client, source-of-business.
- **Integrations:** Outlook/Gmail + calendar sync (mandatory here), e-sign, QuickBooks, later trust-accounting partners.

## 2.6 Retail / Local Commerce (thin, H3)
- **Missing:** product catalog, order/pickup requests, gift cards. Keep thin.
- **Pay more for:** gift cards (cash-flow positive) and pickup orders bolted onto existing industries (bakery custom cakes, salon retail).
- **AI:** product post generator; restock alerts. **Integrations:** Shopify import rather than compete; Square catalog import.
- **Verdict unchanged:** an ARPU expander for existing tenants, never a lead engine.

## 2.7 Beauty (Phase 2)
- All of Appointment plus: **Missing:** color-formula/client-notes vault; booth-renter mode (per-renter revenue + their own mini-login); before/after gallery with consent flags.
- **Pay more for:** booth-rent management (nobody serves it well); no-show protection; Instagram-DM booking.
- **AI should:** book from DMs; generate before/after posts with consent check; fill slow slots with targeted flash offers.
- **Reports:** chair utilization, retail attach, renter statements. **Integrations:** Instagram/Meta DMs, Google Reserve.

## 2.8 Healthcare (Phase 3 light / Phase 4 regulated)
- **Missing:** intake forms engine (build once — every engine reuses), treatment-plan series, recalls, insurance-receipt generation; the compliance workstream itself (BAA, PHI segregation, retention, access logs UI).
- **Pay more for:** recall revenue recovery ("your recall list is worth $48k — book it"); no-show reduction; compliant messaging.
- **AI should:** recall/reactivation campaigns; drop-off prediction mid-treatment-plan; visit-note summarization (strict boundary).
- **Reports:** recall compliance, plan completion, provider utilization, unscheduled-treatment backlog.
- **Integrations:** EMR bridges (read-mostly) rather than replacement; insurance eligibility later.
- **Hard rule:** no PHI feature ships before the compliance workstream signs off. This is the one place "move fast" is wrong.

## 2.9 Automotive (Phase 2)
- All of Appointment plus: **Missing:** vehicle object (VIN/plate decode), digital inspection w/ photos + line-item approve-by-text, parts on estimates, bay board.
- **Pay more for:** approval-by-text (proven to lift average RO dramatically); declined-work resurrection campaigns; tire-storage module (tire shops pay for this alone).
- **AI should:** plain-language repair explanations (trust = approvals); service reminders by mileage/season; estimate follow-up.
- **Reports:** average RO, approval rate, technician efficiency, declined-work bank.
- **Integrations:** parts catalogs (PartsTech-class) later; CARFAX-style history later; start with VIN decode API.

## 2.10 Hospitality (thin, per strategy)
- **Missing (our slice only):** thin reservations/waitlist, event/catering pipeline preset (mostly exists via Lead pipeline), review/marketing bundle SKU.
- **Pay more for:** AI phone that answers "are you open / book 4 at 7" — deflects the #1 operational annoyance; catering pipeline with deposits.
- **AI should:** phone answering, review replies, social from menu photos. **Reports:** review trend, covers via Sofilic, catering revenue.
- **Integrations:** none required v1 (that's the point); later OpenTable/Resy import if demand.

## 2.11 Fitness (Phase 2)
- All of Appointment plus: **Missing:** recurring membership billing w/ dunning; class capacity + waitlist; check-in surface; freeze/cancel flows (legal sensitivity).
- **Pay more for:** failed-payment recovery (instant ROI: recovered MRR is visible money); churn-risk saves; trial conversion engine.
- **AI should:** attendance-decay churn prediction → win-back before cancel; trial nurture; class-fill blasts.
- **Reports:** MRR movement (new/churn/recovered), attendance decay cohorts, trial funnel.
- **Integrations:** door-access hardware later; wearables never (noise).

## 2.12 Pet Services (Phase 2)
- All of Appointment plus: **Missing:** pet object (breed/coat/temperament/vaccines), vaccine gate, report cards w/ photos, boarding capacity calendar.
- **Pay more for:** report cards (owners share them = free marketing); vaccine-compliance automation; holiday-season capacity management.
- **AI should:** draft report cards from groomer notes+photos; breed-cycle rebooking; "is this urgent" vet triage.
- **Reports:** rebook by coat cycle, occupancy (boarding), vaccine compliance.
- **Integrations:** vaccine-record import (photo→OCR is enough v1).

---

# SECTION 3 — WORKSPACE-BY-WORKSPACE AUDIT

Format: **Complete? · Who still beats us · Missing · How we win · AI · Automations · Cross-workspace connections.**

1. **Marketing** — *Staged UI.* Beats us: Mailchimp (sending infra), GHL (funnels). Missing: actual send engine (email service + SMS batching exist in backend integrations — needs campaign objects), segments from CRM, attribution. Win: campaigns triggered by operational events with value-ledger attribution ("this campaign → $4.2k collected"). AI: full campaign generation from goal ("fill next Tuesday"). Automations: lifecycle journeys per industry preset. Connects: CRM segments, Reviews (quote 5-stars), Booking (links), Analytics (ROI).
2. **Communication (Inbox)** — *Staged UI over real backend.* Beats us: Front/Podium inbox maturity. Missing: wiring to Conversation threads, assignment, unread state, WhatsApp. Win: the inbox where AI already answered 80% and shows its work. AI: drafts, summaries, sentiment, handoff triggers. Connects: everything (it's the nervous system).
3. **Voice** — *Backend integration exists (Vapi), no workspace.* Beats us: nobody at SMB price — this is our clearest win. Missing: call log UI, transcripts, AI booking skill per engine, minute metering/billing. AI: it *is* AI. Automations: missed-call text-back (live), voicemail→task. Connects: Appointments/Dispatch (booking), Inbox (transcripts as threads).
4. **Reviews** — *Staged UI; request automation real.* Beats us: Podium/Birdeye (ingestion breadth). Missing: Google/FB OAuth ingestion, reply posting, widget embed. Win: request timing from real job completion + AI replies + price. AI: replies in brand voice, theme mining ("3 mentions of 'late' this month"). Connects: Jobs (triggers), Marketing (social proof), Website (widget).
5. **Documents** — *Real (templates, quotes, invoices).* Beats us: PandaDoc (redlining), DocuSign (ubiquity). Missing: e-sign flow UI, uploads/attachments, template editor UI, version history. Win: documents that know the job/matter/patient context and fill themselves. AI: drafting + explain-this-contract for customers. Connects: Pipeline stages, Portal, Payments.
6. **Knowledge (Company Brain)** — *Backend real (pgvector RAG), no UI.* Beats us: Notion (editing), Guru (verification). Missing: the entire workspace UI + article editor + upload. Win: the brain already powers copilot/receptionist — surfacing it is pure margin. AI: auto-draft SOPs from resolved threads; verify-freshness prompts. Connects: Field copilot, Voice, Training, Inbox suggested answers.
7. **AI (Workforce)** — *Real, thin UI.* Beats us: nobody has the ROI-ledger frame; OpenAI/GPT wrappers have generic agents. Missing: run history, approval inbox (APPROVE authority has no queue!), per-agent config, escalation rules. Win: agents with a P&L. Must-build: **the Approvals Inbox** — the trust surface that makes autonomy adoptable. Connects: everywhere; approvals feed Notifications.
8. **Automation** — *Backend real, UI staged.* Beats us: Zapier (breadth), GHL (recipes). Missing: wire UI to real rules; builder (trigger→condition→action composer); run log with outcomes (backend has EventLog!). Win: presets per industry preloaded + value attribution per rule. AI: "describe what you want" → rule draft. Connects: every module emits/consumes events already.
9. **Analytics** — *Real but shallow.* Beats us: everyone's dashboards are prettier than useful; ours must be *actionable*. Missing: date ranges, drill-downs, export, per-preset KPI packs, goals. Win: every number links to the action that improves it. AI: anomaly narration ("Tuesday bookings fell 40% — likely cause: ad campaign ended"). Connects: value ledger is the spine; briefing consumes it.
10. **Finance** — *Payments real; workspace thin.* Beats us: QuickBooks (accounting — don't compete). Missing: **Stripe Connect embedded payments (take-rate!)**, payout views, expense capture, deposit/partial payments, financing referral. Win: money in = same system as work done; instant reconciliation. AI: collections (exists), cash-flow forecast (exists in briefing — surface it). Connects: Jobs→Invoices→Ledger→Analytics.
11. **People (HR)** — *User model only.* Missing: invite UI (endpoint exists), roles editor, certifications w/ expiry, time-off approvals (backend partially exists), onboarding checklists. Win: certs gating scheduling (coverage engines) — competitors bolt this on. Connects: Scheduling, Field app, Training, Payroll export.
12. **Customer Portal** — *Real backend, static demo page.* Beats us: nobody at this breadth. Missing: real portal deployment per tenant, magic-link auth for customers, payments in portal, per-engine variants. Win: one portal system, five engine skins. Connects: Documents, Payments, Booking, Inbox.
13. **Inventory** — *Absent.* Keep MVP small (parts/products, counts, job consumption). Beats us: dedicated systems always will — we win on "good enough inside the OS." Connects: Quotes (parts lines), Jobs, Purchase orders later.
14. **Fleet/Asset** — *Absent; travel/mileage data already captured by field app!* MVP: vehicles, assignment, maintenance reminders fed by existing mileage logs. Connects: Field app (data source), Dispatch (capacity).
15. **Training** — *Absent.* MVP: courses from Knowledge, completion tracking, cert issuance into HR. Defer past H1. Connects: Knowledge, People.
16. **Media** — *Confirmed non-workspace (audit upholds blueprint kill).* Deliver as: photo pipeline on jobs/report-cards/galleries + "All media" browse in Documents. The *upload infrastructure* however is H1-critical (S3/R2 + attachment model).
17. **Marketplace** — *Real page, first-party.* Missing: install flows that actually configure things (installing "Collections AI" should enable the agent + its automations); pack detail pages; billing hookup. Win: installs that do something in 10 seconds. Connects: AI workforce, Automations, Billing.
18. **Brand** — *Absent.* MVP: logo/colors applied to portal, booking page, documents, review widget. Cheap, high perceived value. Connects: Documents, Portal, Website, Marketing.
19. **Website / Landing Pages** — *Absent.* MVP: one-page site from preset + brand + booking + reviews widget on subdomain. Win: "your website answered the phone" — site, booking, AI in one. This completes the "fire everything else" story. Connects: Booking, Reviews, Brand, CRM forms.

**Workspace verdict:** none are "complete." Three are secretly almost-done because the backend exists (Automation, Communication, Knowledge). Two print money fastest (Voice, Finance/payments take-rate). One is the trust keystone (AI Approvals Inbox).

---

# SECTION 4 — CUSTOMER JOURNEY FRICTION AUDIT

**Signup** — Good: 5-question industry flow (Phase 1). Friction: no email verification (typo = lost account); no password strength meter; no "what happens next" preview; no Google OAuth signup (halves conversion friction for SMBs); tagline under industry select is the only taste of personalization — show a live preview panel ("here's your HVAC workspace") beside the form.

**Onboarding (the biggest hole in the product)** — Today: signup → dashboard full of fictional numbers, no guidance. Required: a *first-run wizard* (connect phone number → import customers CSV → set business hours → invite first teammate → send yourself a test booking) with a persistent checklist showing % complete; sample-mode banner with one-click "clear demo data"; industry-preset welcome ("your Locksmith pipeline is ready — here's how a lockout call flows"). Target: **first real value < 15 minutes** (a test call answered by AI is the "holy shit" moment — front-load it).

**Dashboard/daily** — Friction: numbers aren't real (Section 1); no "today" orientation (calendar strip of today's jobs/appointments at top); no quick actions (new lead / new invoice / take payment from anywhere — FAB or ⌘K); notifications don't accumulate real events.

**Automation** — Friction: owners can't see what automations did for them (runs UI staged). The retention loop is *"look what Sofilic did while you slept"* — a weekly digest email with value attribution is missing and is pure retention gold.

**Communication** — Friction: inbox staged; no mobile push; customers who reply to review-requests or reminders go into a void the owner can't see. Wiring inbox closes the loop.

**Marketing** — Friction: can't actually send anything; channels aren't connectable. Also no unsubscribe/compliance surface (required before real sending: consent flags exist in backend compliance module — surface them).

**Reports** — Friction: no export, no email schedule ("send me this every Monday"), no comparisons (this month vs last).

**Growth/renewal/expansion** — Friction: no in-product upgrade moments (hitting AI-minute caps, user caps should offer one-click upgrade with prorated preview); no annual toggle; no usage page ("you used 240 AI minutes, saved ~6 hours"); cancellation flow doesn't exist (voluntary churn will be invisible); no NPS/health signal capture.

---

# SECTION 5 — UI AUDIT (page-by-page)

**Global:** adopt a stroke-icon set (replace emoji in app chrome; keep emoji in marketing where playful); unify chip/tag/badge semantics; single `formatMoney`/`formatDate` utils; number count-up animation on KPIs; page-transition fade already exists — add stagger for card grids; loading skeletons (CSS exists, **unused — wire into every fetching panel**); empty states with illustration + primary action for: pipeline (no leads yet), inbox, reviews, notifications, marketplace installs, portal documents; error states (fetch fail = quiet retry chip, not silent demo fallback — demo fallback should be *explicit sample mode only*).

**Per page:** Dashboard — real data + "today strip" + configurable widget grid later. Pipeline — drag-drop, filter bar, lead drawer (timeline of events from EventLog), "add lead" modal. Dispatch — wire to jobs API, map view (Phase: static list→map later), assignment drag. Workforce — approval queue tab, run history per agent, enable/disable toggles wired. Automations — real rules list + toggle + run log; builder v1 = template gallery with parameter edits (full composer later). Revenue — wire invoices list + create-invoice flow + record-payment; Stripe Connect onboarding banner. Analytics — range picker, 4 preset KPI packs, CSV export. Inbox/Reviews/Marketing — wire per Section 3. Jobs (Field) — wire to field APIs; PWA pass (installable, camera access) before native. Portal — real portal app at portal.{domain} with magic-link; owner page becomes preview + settings. Settings — real controls: business profile, hours, branding upload, team (invite UI!), integrations (connect flows), API keys UI, audit log viewer, data export button (backend exists). Billing — wire Stripe Checkout + plan switch + usage meters. Notifications — real feed + mark-read + preferences. Marketing site — refresh industries page post-Phase-1 (done), add screenshots/product film, customer-proof section placeholders replaced as real logos arrive; `/resources` articles need real content (currently cards to nowhere — add 8 real guides, they're also SEO).

**Navigation:** current preset-driven groups are right; add: ⌘K palette (nav + entities + actions), breadcrumb-free depth (keep flat), "Simple mode" for solo operators (collapses Grow+Automate into fewer items), mobile bottom-tab bar for the 5 core items in PWA.

---

# SECTION 6 — COMPETITIVE BATTLE PLAN (win without copying)

| Competitor | Their strength | Our play (not a copy) |
|---|---|---|
| **ServiceTitan** | Enterprise trades depth, price-book/financing ecosystem | Don't fight up-market yet. Win 1–15 tech shops on time-to-live (days vs months), AI receptionist, and 1/5th cost. Steal one idea's *job*: good/better/best quotes — via AI quote drafting, not their UI. |
| **Jobber / Housecall Pro** | SMB trades simplicity, payments monetization | They are booking+invoice tools with marketing bolt-ons. We are an OS with an AI staff. Beachhead collision is here — differentiate on: AI answers the phone, reviews+marketing native, industry breadth beyond trades. Match their payments take-rate model (Finance H1/H2). |
| **HubSpot** | Marketing CRM, content machine | We don't sell "CRM." We sell "your business runs itself." Their weakness at SMB: no operations. Never build generic funnels; build industry campaigns from operational events. |
| **GoHighLevel** | Agency white-label, automation breadth | Their users are agencies reselling; UX is notoriously dense. We win direct owners on polish + real ops (jobs, dispatch, payroll hours) they can't fake. Consider (H3) a light agency/partner program — GHL proved the channel. |
| **Monday** | Flexible work OS, beautiful | Generic = the customer does the design work. Our presets ARE the product. Borrow the *feeling* of delight (motion, color discipline), never the blank-canvas model. |
| **Salesforce** | Platform gravity, enterprise trust | Irrelevant to a 6-person plumber except as a cautionary tale of complexity. Our anti-Salesforce pitch is literal: zero admins required. |
| **Microsoft 365 / Google Workspace** | Email/docs/calendar ubiquity | Coexist, integrate (calendar + email sync H2 — mandatory for professional services), and position above: they are tools, Sofilic is the business layer that uses them. |
| **Shopify** | Commerce OS, app economy | Don't touch e-commerce. Copy the *playbook* shape only: obsessive merchant success content, an app ecosystem (H3), and "Powered by" ubiquity via booking pages/portals. |
| **OpenAI (and AI-native upstarts)** | Foundation models, agent hype | Models are our substrate, not our moat. Our moat = proprietary operational data per tenant + value-ledger attribution + distribution into 42 industries. An AI-native competitor must rebuild our ops spine to match; we must never let our AI feel like a chat box bolted on — it acts inside the system of record. |

**The one-line strategy vs all of them:** every competitor sells software the owner must operate. **Sofilic sells outcomes an AI staff produces, with receipts (the value ledger).**

---

# SECTION 7 — MASTER ROADMAP (2–3 years)

**North-star metric:** *Attributed value per tenant per month* (value-ledger dollars Sofilic booked/collected/recovered) — with guardrails: weekly active owners, AI containment rate (% conversations resolved without human), tenant NPS, logo churn.

**Product principles (apply to every ticket):** 1) Real data or labeled sample — never ambiguous. 2) Every number links to an action. 3) AI acts inside the system of record and shows receipts. 4) Preset-first: nothing ships that can't be configured per industry. 5) A solo operator must never feel the enterprise surface.

### HORIZON 1 — "Make it true" (Months 0–6)
*Theme: convert staged→real, close table-stakes gaps, ship Appointment+Voice (blueprint Phase 2), open the money loop.*
- **H1.1 Truth sprint (M1–2):** dashboard aggregation API + real widgets; wire Automations UI to rules engine + run log; wire Inbox to threads; wire Revenue to invoices/payments + create/record flows; real Notifications feed; invite-user UI; forgot-password + email verification; file/photo upload infra (R2/S3) + photos on jobs; empty/loading/error state pass; ⌘K search v1 (entities+nav).
- **H1.2 Money loop (M2–3):** Stripe Checkout for subscriptions + plan management + usage meters; **Stripe Connect embedded payments** for tenants (take-rate ON) + payout views; deposits on booking; annual plans.
- **H1.3 Onboarding & activation (M2–3):** first-run wizard, sample-mode with clear-data, preset welcome tours, weekly "what Sofilic did" digest email, test-call moment in first 15 minutes.
- **H1.4 Appointment engine + Voice workspace (M3–6):** per blueprint Phase 2 scope; booking page (public) ships here and back-ports to field-service presets (request-a-visit mode); AI phone booking against real availability; minute metering; no-show protection; the ~20 Phase-2 industry presets.
- **H1.5 Engineering hygiene (continuous):** CI (build+test on PR), Sentry both apps, staging environment, feature flags, seed scripts per preset, PWA pass on field app.
- **Exit criteria:** a new HVAC or salon signup reaches first real booked job/appointment via AI within day 1; zero staged surfaces remain; payments take-rate live; MRR machinery (checkout→upgrade→dunning) complete.

### HORIZON 2 — "Depth & distribution" (Months 6–18)
*Theme: engine depth (Coverage/Property/Case), mobile, integrations, AI trust surfaces, reviews/social for real.*
- **H2.1 AI trust layer:** Approvals Inbox for APPROVE-authority agents; per-agent run history + settings; AI QA sampling view; containment analytics. (This is what makes owners raise autonomy — the ARPU lever.)
- **H2.2 Reviews/Social real:** Google Business Profile + Meta OAuth apps; ingestion, reply-posting, publishing; review widget; theme mining.
- **H2.3 Coverage + Property + Case engines** (blueprint Phase 3 scope) incl. payroll export, owner statements, retainer/deadline engines; certifications in People gating rosters.
- **H2.4 Mobile:** field app native (or hardened PWA→native shell) with offline job packet, camera, GPS, push; owner app (dashboard, approvals, inbox, "money today").
- **H2.5 Integration platform:** QuickBooks/Xero sync; Google/Outlook calendar+email sync; webhooks UI + Zapier listing; VIN decode; CSV import framework v2 (mapping UI).
- **H2.6 Website workspace + Brand kit;** portal magic-link auth; per-engine portal variants.
- **H2.7 Physio/chiro/vet/wellness presets** (light-compliance healthcare entry).
- **Exit criteria:** 35+ live presets across 4 engines; mobile DAU among field staff; take-rate + AI usage ≥ 25% of revenue; integration-driven churn objections eliminated (QB!).

### HORIZON 3 — "Compounding moats" (Months 18–36)
*Theme: regulated healthcare, intelligence products, ecosystem, up-market.*
- **H3.1 Healthcare compliance workstream** → dental/medical/home-care launch (BAA, PHI segregation, access-log UI, retention policies).
- **H3.2 Sofilic Intelligence:** cross-tenant anonymized benchmarking ("you vs similar HVAC companies"), forecasting, pricing guidance — the data product no point-solution can copy.
- **H3.3 Ecosystem:** marketplace third-party SDK (carefully), partner/agency program (GHL channel lesson, our polish), template economy rev-share.
- **H3.4 Fintech adjacency:** instant payouts, consumer financing referrals at quote, working-capital referrals — margin lines Jobber/HCP already proved; evaluate card issuing later. (Referral-first; never balance-sheet risk early.)
- **H3.5 Multi-location & franchise:** org rollups (Organization model exists!), cross-location reporting, brand controls; light white-label evaluation.
- **H3.6 Voice everywhere:** outbound AI (reminders, recalls, collections calls where lawful), multilingual.
- **Exit criteria:** Sofilic is the system of record AND the intelligence layer for 40+ industries; >3 revenue lines (SaaS, payments, AI usage, marketplace); credible 15–50 seat mid-market wins against ServiceTitan-class tools.

### Sequencing rationale (why this order)
Truth before growth (staged surfaces poison trust) → money loop before marketing spend (monetize activation) → appointment+voice next because it multiplies TAM and demoes magically → depth before healthcare (earn the right) → intelligence/ecosystem last (require scale to exist).

---

*This document is the master roadmap. On approval, each Horizon decomposes into the same phase-gate implementation style used for Phase 1 (build additively, verify live, ship weekly).*
