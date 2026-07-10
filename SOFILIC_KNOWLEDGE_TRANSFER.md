# SOFILIC — Complete Knowledge Transfer Document
### For an external senior architect / AI reviewer with zero prior context
*Written by the AI that has built and audited this project end-to-end. This document explains the PRODUCT, not the code. Companion documents (`SOFILIC_PRODUCT_STRATEGY.md`, `SOFILIC_INDUSTRY_WORKSPACE_BLUEPRINT.md`, `SOFILIC_PRODUCT_AUDIT_AND_MASTER_ROADMAP.md`) go deeper on strategy, industry-by-industry detail, and the 2–3 year roadmap respectively — this document is the one-stop orientation.*

---

## 1. Project vision and purpose

Sofilic is being built as **the Business Operating System for local businesses** — one login that replaces the 5–7 disconnected subscriptions a typical local business owner currently pays for (a booking tool, a CRM, a texting/answering service, a review-management tool, an invoicing tool, a marketing tool, and a scheduling tool), and adds a staffed layer of **AI employees** that do real revenue-generating work (answer the phone, qualify leads, dispatch jobs, chase overdue invoices, request reviews) with every action logged against a **value ledger** so the owner can see, in dollars, what the AI did for them.

The company was originally branded "AI Operations Workforce," narrowly scoped to field-service trades (HVAC/plumbing/etc.). It has since been **rebranded to Sofilic** and the vision has been deliberately widened: not an HVAC app, not a CRM, but a horizontal operating system that reconfigures itself per industry via configuration rather than by building separate products.

The founding product thesis, stated plainly: **every competitor sells software the owner must operate; Sofilic sells outcomes an AI staff produces, with receipts.**

---

## 2. Current positioning

- **Category claim:** "The AI Business Operating System" / tagline "Run your entire business with AI."
- **Target buyer:** owner-operators of local service businesses, typically 1–30 staff, currently underserved by both consumer-grade booking apps (Calendly-class) and enterprise trade software (ServiceTitan-class, priced/scoped for much larger operations).
- **Wedge/beachhead:** field-service trades (HVAC, plumbing, electrical, roofing, cleaning, landscaping, pest control, locksmith, appliance repair, garage door) — chosen because (a) proven high software spend in this segment, (b) missed-call and emergency-dispatch AI has provable same-day ROI, (c) the backend engine for this segment is the most mature.
- **Expansion thesis:** the same backend, config-driven, expands into Appointment-based industries (beauty, fitness, automotive, pet, wellness), then Coverage/Security and Property Management, then Professional Services (law, accounting, agencies, real estate), then regulated Healthcare — all without rearchitecting.
- **Explicit non-targets (by design):** Sofilic will not build a POS or compete in restaurant table/kitchen operations (Toast/Square own that layer); will not build e-commerce/retail checkout (Shopify's territory); will not build a generic internal team-chat product (Slack is free and entrenched).

---

## 3. Current architecture (high level, no code)

**Two applications, one shared backend, one database:**
- **API** — a multi-tenant backend serving all business logic: authentication, tenant isolation, CRM, jobs/dispatch, scheduling, payments, AI agents, automations, analytics, marketplace, public developer API.
- **Web** — a single Next.js application serving two very different experiences from one codebase: (1) a public marketing site (landing page, features, industries, pricing, demo, resources, login/signup) and (2) the authenticated product ("Sofilic OS") — a sidebar-driven application shell containing the dashboard and all internal modules.
- **Database** — one PostgreSQL database (with the pgvector extension for AI embeddings/RAG) serving every tenant. Multi-tenancy is enforced by tagging virtually every row with a tenant identifier and structurally guaranteeing (via a query-layer hook, not application-level discipline) that a request can never read or write another tenant's rows — this is described internally as "fail-closed" tenant isolation, meaning if the system can't prove a query is properly scoped, it throws rather than silently leaking data.
- **Background worker** — a separate process from the API that runs the job queue (used for scheduled/async work such as automation execution, AI agent runs, and payment-sweep recovery).
- **AI layer** — not a single "chatbot" bolted on. AI capability is distributed as: (a) a conversational receptionist/voice agent that can book real appointments/jobs, (b) a roster of installable "AI employees" each with a defined job (Sales, Collections, Customer Success, Marketing, Receptionist, Executive, Recruiting, Operations Manager) and an "authority level" (fully autonomous vs. requires human approval), (c) a retrieval-augmented "Company Brain" (vector search over uploaded business documents) that other AI features draw context from, and (d) an "Executive Briefing" agent that synthesizes the business's real numbers into a daily narrative brief.
- **The industry-adaptation mechanism (the core IP):** rather than building separate products per industry, a single backend concept — the "Industry Module Config" — supplies vocabulary, pipeline stages, job statuses, intake questions, document templates, and seeded automations for a given business type. Choosing an industry at signup selects one of these configs, and the same UI, same data model, and same AI re-skin themselves around it with zero code changes for that industry. This is the mechanism the whole 42-industry expansion strategy depends on.
- **Deployment:** currently self-hosted on a single Hetzner VPS via Docker Compose (Postgres+pgvector, Redis, API, worker, Web, behind Nginx with TLS). A Kubernetes manifest and Terraform skeleton exist for a future move to a managed cluster but are not the live deployment path today.

---

## 4. Every implemented feature (backend has a real, working implementation)

- Multi-tenant account system: tenant (business) creation via public self-serve signup, JWT access + refresh token authentication, role-based access control with four ranked roles (Customer < Staff < Admin < Owner), portal-scoped tokens for end-customers.
- CRM: generic Lead entity (used as "the thing that becomes business") with a configurable pipeline (stage board), Contact records, and industry-driven vocabulary swapping (a "Lead" is called a "Service Request" for a trade business and something else for another vertical, all backed by the same table).
- Jobs: generic Job entity representing scheduled/dispatched work, with statuses (unscheduled → scheduled → dispatched → in progress → on hold → completed → cancelled) and industry-specific labels.
- Scheduling: staff working-hours configuration, time-off requests, conflict-free slot-finding across a calendar, a bookable calendar view, and a manual booking creation flow.
- Field operations backend: technician clock-in/out and break tracking, per-job start/stop timers, travel/mileage logging, a daily route endpoint, and an "AI field copilot" that can summarize a job, pull customer history, answer SOP/troubleshooting questions, and give safety guidance — all backed by real endpoints.
- Smart dispatch logic: assignment consideration by skill, service zone, availability and urgency, with an emergency fast-track path.
- Documents: quote and invoice generation from per-industry templates, contract/form templates, PDF generation.
- Payments: Stripe-backed payment processing with a compare-and-swap settlement mechanism specifically engineered to prevent double-booking revenue under concurrent webhook delivery; a "value ledger" records every credit event (a payment collected, a discount, etc.) as the single source of truth for financial reporting; a startup "sweep" job recovers stale pending payments.
- Automation engine: a real rule engine (trigger → condition → action) with per-industry seeded presets (e.g., missed-call text-back, emergency dispatch, post-job review requests, seasonal re-engagement), executed under advisory database locks to guarantee exactly-once behavior under concurrency, with outcomes logged to an event log.
- AI workforce: a roster of named AI employee types, each installable per tenant, each with an authority level, each able to be manually triggered to "run" a task, and a leaderboard endpoint reporting tasks completed / revenue generated / net value / success rate per agent — this is genuinely wired to the value ledger, not a mockup.
- Omnichannel messaging backend: unified "conversation thread" model spanning voice, SMS, chat and email, with a global Message model (one of the few models that intentionally bypasses tenant scoping because messages can span a channel before tenant resolution).
- Voice integration: a real integration with a third-party voice AI provider (Vapi) to power the phone-answering agent.
- Marketplace backend: a catalog of installable listings (AI employees, workflow packs, industry template packs, integrations) with install tracking, ratings, and download counts.
- Billing backend: subscription plan records and a billing summary endpoint combining subscription state with real revenue figures from the value ledger.
- Public developer API: a versioned `/v1` surface with per-API-key scopes (e.g., read:leads, read:jobs, read:invoices, read:account) and Redis-backed per-key rate limiting.
- Compliance and audit: an audit log for sensitive actions, consent record tracking, and a data export/erasure flow aligned with GDPR/PIPEDA-style requirements.
- Analytics: a value-ledger-backed KPI endpoint (revenue, net value, new leads, jobs completed, conversion rate, pipeline value) and an "Executive Briefing" endpoint that assembles KPIs, a 30-day revenue forecast, overdue invoices, pending approvals and urgent jobs into a prioritized narrative.
- Security hardening from a full certification pass: strict input validation, environment-variable enforcement at boot in production (refuses to start without required secrets), SSRF protection on outbound webhook URLs, AES-256 encryption at rest for stored third-party credentials, Helmet security headers, CORS allowlisting.

---

## 5. Every planned feature (not yet built, on the roadmap)

From the Master Roadmap, in rough priority order: a dashboard-aggregation endpoint so the UI shows real numbers instead of demo data; a public customer-facing booking page; a first-run onboarding wizard with a "clear sample data" mechanism; Stripe Checkout wiring so subscription plans can actually be purchased; Stripe Connect embedded payments so Sofilic can take a payments margin (a major planned revenue line, not yet implemented); a staff-invite UI (the backend endpoint already exists); password reset, email verification, and eventually 2FA; a file/photo upload pipeline (no object storage is wired yet — no attachments exist anywhere in the product today); global search; a real "Appointment Engine" (bookable resources — chairs/rooms/bays — recurring appointments, group/class capacity, no-show/deposit handling) to power the entire Beauty/Fitness/Automotive/Pet/Wellness expansion; a "Coverage Engine" for security guard/patrol/facility businesses (sites, shift rosters, checkpoint scans, incident and daily-activity reporting, payroll export); deeper "Case Engine" for professional services (matters, time entries, retainers, deadline tracking); native or hardened-PWA mobile apps for field staff (offline mode, camera, GPS); real integrations with QuickBooks/Xero, Google/Outlook calendar and email; a healthcare compliance workstream (BAAs, PHI handling, access-log UI) required before any dental/medical launch; cross-tenant anonymized benchmarking/intelligence products; a real marketplace install flow that actually configures what it installs; a Brand/Website workspace so a tenant can have a public one-page site generated from their preset.

---

## 6. Every module and workspace

**Universal Core (every tenant, every industry — non-removable):** Dashboard, CRM/Customers, Calendar, Tasks, Communication, Documents, Billing/Finance, Analytics, Automation, Settings, Customer Portal, AI Workforce, Marketplace surface.

**The 20 "Universal Workspace" catalog defined in the blueprint** (each independently gradeable as Core / Add-on / Marketplace, at various stages of build — see Section 25 for gaps): Marketing, Social Media, Brand Studio, Communication, Voice, Reviews/Reputation, Documents, Knowledge/Company Brain, Media (deliberately NOT built as a standalone workspace — folded into Documents/job records instead), Finance, HR/People, Training, Inventory, Fleet/Asset, Website/Landing Pages, Customer Portal, Automation, AI Workforce, Analytics, Marketplace.

**Industry Engine modules (only mounted for the relevant industries):** Pipeline/Dispatch/Field App/Zones/Maintenance Plans (Field Service engine — live); Appointments/Resources/Services/Packages/Memberships (Appointment engine — planned); Sites/Guards/Shifts/Patrol Tours/Checkpoints/DAR/Incidents (Coverage engine — planned); Properties/Units/Tenants/Leases/Maintenance Requests/Owners (Property engine — planned, exists today as a thin preset); Matters/Time/Retainers/Deadlines (Case engine — planned, exists today as a thin preset called "Service Agencies").

---

## 7. Every sidebar item

The application sidebar is intentionally organized into a small, fixed set of top-level groups so the navigation never becomes a 100-item wall, regardless of industry. As currently implemented (default/fallback nav, with industry-specific nav intended to override it — see Section 29 for the gap here): **Operate** (Dashboard, Pipeline, AI Workforce, Dispatch, Field Team, Customer Portal), **Grow** (Revenue, Analytics, Executive Briefing), **Marketing** (Reviews, Marketing Studio), **Communication** (Inbox, Notifications), **Automate** (Automations, Workflows, Marketplace), **Manage** (Billing, Settings). The blueprint's target structure (Dashboard / Operations / Customers / Marketing / Communication / Finance / People / AI / Analytics / More / Settings) is the intended future state once industry-specific nav groups are actually served by the backend.

---

## 8. Every dashboard

- **Owner "AI Command Center" dashboard** (`/dashboard`): the flagship screen — a status hero, six headline KPI cards (today's revenue, new leads, booked jobs, completed jobs, urgent issues, AI employees active), the live pipeline board, an AI workforce activity feed, a dispatch board summary, field-team status, customer-portal activity, an invoice/payments summary, automation health, AI-generated executive recommendations, recent notifications, upcoming jobs, and marketplace recommendations.
- **Analytics dashboard** (`/analytics`): KPI cards plus a revenue trend chart, intended to be backed entirely by the value ledger.
- **Executive Briefing** (`/executive`): a narrative daily brief plus supporting signal cards (revenue forecast, overdue invoices, pending approvals, urgent jobs).
- **Field/staff dashboard** (`/jobs`): today's assigned jobs for a technician with one-tap status controls — the minimal mobile-first surface field staff use.
- **Customer Portal dashboard** (`/portal`): the end-customer's own view — upcoming visit, documents (quotes/invoices with pay links), and conversation history.

---

## 9. Every workflow

**Built and real (backend-executed):** lead capture → AI qualification → dispatch → field completion → invoice/payment → executive insight (the core loop the whole product is built around); missed-call → automatic SMS text-back with booking link; emergency-urgency lead → fast-track dispatch + owner alert; job completed → wait period → review request SMS; seasonal/maintenance re-engagement campaigns; quote sent → follow-up sequence; parts-arrived → auto-offer return visit slot (designed in config, not yet fully wired end-to-end); tenant onboarding (signup → provision tenant → seed automations → owner login).

**Staged/incomplete workflows (UI exists, real backend exists, but they are not wired together end-to-end today):** the Automations page shows four hardcoded example rules instead of the tenant's actual seeded automation rules; the Workflows/Runs page shows fabricated example runs instead of the real Event Log; the Inbox shows no real conversation threads even though the Message/thread backend is real; Reviews shows no real Google/Facebook review ingestion.

---

## 10. Every AI capability

1. **AI Receptionist / Voice agent** — answers calls, has natural-language booking conversations, qualifies urgency, books real jobs/appointments. Powered by a third-party voice AI provider integration.
2. **Sales AI** — scores and qualifies leads, drafts quotes, follows up on silence, either autonomously or pending approval.
3. **Collections AI** — chases overdue invoices automatically.
4. **Customer Success AI, Marketing AI, Recruiting AI, Operations Manager AI, Executive AI** — additional named agent roles in the workforce roster, each with a department and an authority level.
5. **AI Field Copilot** — job summaries, customer history lookup, SOP question-answering, troubleshooting help, and safety guidance for a technician in the field.
6. **Executive Briefing agent** — synthesizes real business data into a daily prioritized narrative.
7. **Company Brain (RAG)** — a vector-search knowledge base over uploaded business documents that other AI features (copilot, receptionist) draw context from; the retrieval infrastructure exists in the backend but has no dedicated user-facing workspace yet.
8. **AI Leaderboard** — not itself an AI capability, but the accountability mechanism: every agent's actions roll up to tasks completed, revenue generated, net value, and success rate, visible to the owner.

**Missing AI trust surface (identified in the audit as a priority gap):** agents with "APPROVE" authority (as opposed to fully autonomous) have no approval inbox/queue in the UI today — there is no way for an owner to actually review and approve/reject a pending AI action, which undermines the entire "approval mode" concept as currently shipped.

---

## 11. CRM features

Lead entity with configurable pipeline stages (label, color, hidden-flag per stage, defined per industry); Contact records; a kanban-style pipeline board UI with stage columns; per-lead urgency flagging (used prominently in field-service emergency triage); industry-driven vocabulary (the same Lead table is presented as "Service Request," "Quote Request," "Emergency Call," etc. depending on the tenant's industry config, all without schema changes). Not yet built: drag-and-drop stage movement in the UI, a lead detail drawer/timeline, filtering/search within the pipeline, lead source tracking/attribution.

---

## 12. Marketing features

Backend: none of substance exists yet beyond the review-request automation and the general messaging (SMS/email) send capability that other workflows use. Frontend: a "Marketing Studio" page exists in navigation but is described in the audit as staged (no real campaign-sending infrastructure, no audience segmentation, no attribution). Planned: campaign objects, audience segments drawn from CRM, multi-step nurture journeys, attribution of campaign performance back to the value ledger (so a campaign can be shown to have generated $X), AI-generated campaigns triggered by real operational events (e.g., a completed job auto-drafts a before/after social post).

---

## 13. Social media features

Not built. Planned as part of the Marketing/Social workspace: OAuth connections to Google Business Profile, Facebook, and Instagram; an AI post generator that drafts content from real business events (a completed job, a 5-star review) rather than generic prompts — positioned as a structural advantage no generic social scheduling tool (Buffer, Hootsuite) can replicate, since they have no access to a business's operational data. TikTok and LinkedIn are explicitly deprioritized (deemed low-ROI for the target local-business customer) per the strategy document's kill list.

---

## 14. Automation engine

This is one of the most mature pieces of the real backend and one of the least-surfaced in the UI (a "wire the UI to the real thing" priority in the roadmap, not a "build the thing" priority). Structurally: a rule is a trigger event, a set of conditions evaluated against the event payload (dot-path comparisons: equals, not-equals, in-list, greater-than, less-than, exists, contains), and an ordered list of actions (send SMS, send email, send WhatsApp, create task, assign staff, update pipeline stage, create booking, generate document, trigger an AI agent, or wait). Each industry's config seeds a starter set of automation presets (e.g., field-service gets missed-call text-back and emergency fast-track; other industries get their own). Execution is protected by database advisory locks to prevent double-firing under concurrent event delivery, and every run is logged. None of this real machinery is currently visible to a tenant in the product UI — the Automations page instead shows four hand-written example rules.

---

## 15. User management

Roles: Customer, Staff, Admin, Owner, in a strict numeric rank order used for authorization checks (a lower-ranked role is rejected from higher-ranked routes). Authentication: email/password login issuing a short-lived access token and a long-lived refresh token; a separate "portal token" type scoped specifically to end-customers accessing the Customer Portal, audience-restricted so it cannot be used against staff routes. Tenant creation (signup) is public and self-serve, provisioning a business, its owner user, and seeded automations in one call. Staff/technician invitation has a real backend endpoint (owner-only) but currently has no corresponding UI — an owner cannot actually invite a teammate from the product today. No password reset, no email verification, no 2FA exist yet.

---

## 16. Calendars

A real scheduling backend exists: per-staff working-hours windows (day of week + start/end minute), time-off requests, a conflict-free slot-finding algorithm (given a staff member, a date range, and a desired duration, returns bookable slots), a calendar view assembling bookings globally or per-staff, and a manual booking-creation endpoint. This is the direct foundation the planned "Appointment Engine" will extend with bookable *resources* (not just staff — chairs, rooms, bays) and recurrence, which is required before Sofilic can properly serve appointment-based industries like salons or clinics.

---

## 17. Pipelines

The Lead pipeline (CRM board) is the primary pipeline concept, industry-configurable as described in Section 11. A second, structurally distinct pipeline concept exists in the Job lifecycle (unscheduled → scheduled → dispatched → in progress → on hold → completed → cancelled), which is the operational pipeline once a lead converts. The planned Case Engine will introduce a third pipeline shape (a "matter" moving through phases/milestones over weeks or months, rather than a single lead-to-job conversion) for professional-services industries.

---

## 18. Payments

Stripe is the payment processor. The core engineering achievement here is correctness under concurrency: a payment settlement uses a compare-and-swap update (only transitions a payment from PENDING to SUCCEEDED if it is still PENDING at the moment of the database write) specifically to prevent a double-booked revenue entry if the same webhook or settlement path fires more than once concurrently — this was verified under live concurrent-request testing during a prior certification pass and is a genuine point of engineering quality. A separate startup "sweep" job recovers payments that got stuck in a PENDING state (e.g., a webhook that never arrived) after a timeout. All money-in events (a successful payment, specifically) are recorded as CREDIT entries in a "value ledger," which is the single source of truth every analytics and AI-workforce ROI figure is computed from — this ledger-first design is what makes the "AI made you $X this month" claim credible rather than marketing fiction. Not yet built: any way for a tenant to actually receive Sofilic subscription payment (Stripe Checkout is not wired to the Billing page), and no Stripe Connect embedded-payments flow exists yet for tenants to collect from *their* customers with Sofilic taking a margin (identified in the roadmap as likely the single largest untapped revenue line for the company itself).

---

## 19. Reports

Real: a KPI endpoint (revenue, net value, new leads, jobs completed, conversion rate %, pipeline value) computed from the value ledger and CRM/job tables; the Executive Briefing narrative report; the AI Workforce leaderboard (per-agent tasks/revenue/net-value/success-rate). Missing: date-range selection, drill-down from a KPI into the underlying records, CSV/PDF export, scheduled/emailed reports, comparison periods (this month vs last), and industry-specific KPI packs (e.g., recall compliance rate for healthcare, coverage fill rate for security) which the blueprint specifies per-industry but which do not exist as computed metrics yet.

---

## 20. Industry presets

**The mechanism (real, built):** an "Industry Module Config" object supplies, per industry: a vocabulary map (what a Lead/Job/Contact is called), pipeline stage labels and colors, job status labels and colors, the fields a voice/chat intake agent must collect (with natural-language prompts for each), document templates, and a set of seeded automation presets. A tenant selects one industry key at signup; the entire product re-skins around it with no code changes for that tenant.

**Current actual coverage (important gap to understand — see Section 25):** despite the marketing site and product strategy documents describing 42 target industries and a Phase 1 rollout of ~14–16 field-service trades, the backend configuration package today contains only **three** implemented industry configs: `FIELD_SERVICES` (a generic trades config — HVAC, plumbing, electrical, etc. all currently share this *one* generic config rather than each having its own distinct preset), `PROPERTY_MANAGEMENT`, and `SERVICE_AGENCIES` (the placeholder for the Case/professional-services engine). The blueprint's vision of one dedicated preset per named trade (a distinct HVAC preset vs. a distinct Plumbing preset, each with its own document templates and automation flavor) has **not yet been implemented** — this is the single most important "planned vs. actually built" gap for a new architect to understand, because the marketing and UI already talk as if it exists.

---

## 21. Marketplace

Real backend: a catalog of listings typed as agent / workflow / template / integration, each with a price (or free), a rating, and a download count; an install-tracking endpoint. Real UI: a marketplace browsing page with type filtering. Missing: installing a listing does not currently *do* anything functionally (e.g., installing "Collections AI" from the marketplace does not actually enable that agent or wire its automations) — the install action and the actual activation of what's installed are not yet connected. No detail pages per listing, no billing hookup for paid listings.

---

## 22. APIs and integrations

**Public developer API:** a versioned `/v1` REST surface, protected by per-API-key scopes (read:leads, read:jobs, read:invoices, read:account) and Redis-backed per-key rate limiting — real and tested. No self-serve UI exists for a tenant to create/manage their own API keys yet (this must currently be done outside the product).

**Third-party integrations, current state:** Stripe (payments — real, deeply integrated), Vapi (voice AI — real integration powering the phone-answering agent), Twilio (SMS — referenced/configured for messaging), SendGrid (email — referenced/configured), Google Calendar (referenced in config, not confirmed deeply wired). **Explicitly not yet built:** QuickBooks/Xero accounting sync (repeatedly flagged in the audit as a near-mandatory integration for the Field Service and Professional Services engines — its absence is a plausible deal-breaker for prospects already using accounting software), Outlook/Gmail calendar and email sync (considered mandatory for the Professional Services engine specifically), any SMS/voice number provisioning self-serve flow, Zapier or a general webhook-management UI (webhook *subscription* backend with SSRF protection exists for the enterprise integrations platform, but no tenant-facing management screen).

---

## 23. Database overview (product-level, not schema-level)

One shared PostgreSQL database (with the pgvector extension enabled for AI embedding search) serves all tenants. The practical model to understand: almost every business record (a Lead, a Job, a Contact, a Document, a Payment, an Automation Rule, etc.) carries a tenant identifier, and the query layer is configured to refuse to execute most queries against these tables unless a tenant context has been established for the request — described as "fail-closed" because the failure mode of a bug here is an error, not a silent cross-tenant data leak. A small number of models are deliberately global/tenant-agnostic by design: the Tenant record itself (obviously), the Organization record (used for a not-yet-built multi-location/franchise rollup capability), the Message model (because a raw inbound message, e.g. an SMS, may need to be routed *before* the system knows which tenant it belongs to), and the Marketplace listing catalog (shared across all tenants, not owned by one). Two real migrations have been applied to the production database: the initial full schema plus pgvector extension setup, and a later migration adding HNSW vector indexes for embedding search performance.

---

## 24. Current strengths

1. **Payment/revenue integrity engineering** is genuinely production-grade — the concurrent-settlement and value-ledger design is a real technical asset, not a cut corner, and was specifically stress-tested.
2. **Multi-tenant security posture** is mature: fail-closed isolation, RBAC, encrypted credentials, SSRF protection, environment-enforced production boot checks, audit logging — this came out of a dedicated security certification pass, not an afterthought.
3. **The industry-config abstraction is real and it works** — it is the single most important piece of architecture for the company's stated horizontal-platform ambition, and Phase 1 already proved it can re-skin the product per tenant with zero code changes.
4. **The AI-workforce-with-a-ledger framing is a genuine differentiator.** No competitor examined in the competitive analysis (ServiceTitan, Jobber, Housecall Pro, HubSpot, GoHighLevel, generic AI wrapper products) can currently show an owner a dollar figure of value an AI agent produced, because none of them have a value-ledger architecture underneath their AI features.
5. **The premium UI/brand system** (Sofilic wordmark, dark glassmorphism design language, marketing site) is well ahead of typical SMB-software visual quality and was explicitly built to compete visually with Stripe/Linear/Notion-tier products.
6. **The automation engine's concurrency safety** (advisory locks, exactly-once execution) is a level of engineering rigor uncommon at this stage of a product.

---

## 25. Current weaknesses

1. **The "staged UI over demo data" problem is the single biggest weakness of the product today.** A large fraction of the visible surface (dashboard KPIs, the dispatch board, the revenue/invoices table, workflow run history, the inbox, reviews, notifications, marketing studio, most of Settings) displays hardcoded or fabricated sample data rather than being wired to the real backend endpoints that, in most cases, already exist. A new user cannot tell what is real. This is a trust risk disguised as a UI-completeness risk.
2. **The industry preset catalog is far shallower than the product's own marketing and documentation claim.** Only 3 backend presets exist (Field Services generic, Property Management, Service Agencies) against a stated 42-industry, ~14–16-trade Phase 1 ambition. The frontend sidebar already expects a `preset.navGroups` field from the backend config that does not exist yet, meaning the "industry-specific navigation" feature is currently silently falling back to a generic default nav for every tenant.
3. **The money loop is not closed.** A prospective customer cannot actually pay Sofilic for a subscription (no Stripe Checkout wiring on the Billing page's "Choose Plan" buttons) and a tenant cannot invite a teammate through the UI despite the backend supporting it — meaning a real end-to-end signup-to-paying-team cannot currently be completed without engineering intervention.
4. **No file/photo upload capability exists anywhere in the product.** No object storage integration is wired. This is a significant gap for field-service trades (before/after photos are one of the highest-value artifacts in that industry) and for every other engine (report cards, inspection photos, document attachments).
5. **No account-recovery flows** (password reset, email verification) — a real operational risk for any live customer base.
6. **The AI "approval mode" concept is incomplete.** Agents can be configured with an APPROVE authority level, but there is no approval queue/inbox UI for an owner to actually review pending actions — the concept exists in the data model but has no functioning surface.
7. **No engineering hygiene infrastructure confirmed:** no CI pipeline verified, no error tracking (e.g., Sentry) confirmed wired, no formal staging environment discipline, no feature flag system — meaning every deploy to the single production Hetzner server carries more risk than necessary.
8. **Marketplace installs are cosmetic** — installing a listing does not activate anything.
9. **No integrations exist yet for QuickBooks/Xero or calendar/email sync**, both flagged repeatedly across engines as likely blocking objections for real prospects.

---

## 26. Features considered over-engineered relative to current stage

- **The public developer `/v1` API with per-key scopes and rate limiting** is enterprise-grade infrastructure built before there is any self-serve way for a tenant to even generate a key or before there is developer demand evidence — reasonable to have built once, but investing further here ahead of the money loop and file uploads would be a sequencing mistake.
- **The Kubernetes manifests and Terraform skeleton** exist for a deployment model (managed cluster) the company is not using (currently a single Docker Compose VPS) — fine as a documented future path, but not a current priority and shouldn't absorb more engineering time until there's a scaling reason to move off the simpler deployment.
- **The Organization model for multi-location/franchise rollups** exists in the data model ahead of any tenant actually having multiple locations — reasonable as a forward-compatible schema decision, but the associated UI/reporting work should not be pulled forward.
- **Eight distinct named AI employee roles** were designed before any of them (beyond Receptionist/Sales/Collections in practice) have been proven to be something a real owner actually wants installed and running — the roster may be broader than current validated demand.

---

## 27. Features considered under-developed relative to their strategic importance

- **Reviews/Reputation** is positioned in the strategy document as the single highest-leverage universal workspace to ship first (it directly replaces a $300–500/mo competitor product — Podium/Birdeye — for every industry), yet it remains almost entirely unbuilt beyond the review-request-send automation. This is the clearest mismatch between stated priority and actual build state.
- **The Automation engine and Communication (inbox) backend** are both genuinely mature and almost entirely un-surfaced — these represent the highest-ROI "wire it, don't build it" opportunities in the entire roadmap, and are currently under-leveraged relative to how much backend investment they already represent.
- **Onboarding/first-run experience** is essentially absent (a new signup lands directly on a dashboard full of someone else's-looking sample numbers with no guidance) despite activation being the highest-leverage lever on any subscription business's growth.
- **The Knowledge/Company Brain RAG system** is real, working infrastructure (vector search, embeddings) with zero user-facing surface — it currently only powers other AI features invisibly. Packaging it as its own workspace was assessed as "near-zero backend work, large perceived value" and remains undone.

---

## 28. What makes Sofilic unique

1. **Value-ledger-backed AI accountability** — every AI agent's work is tied to a auditable financial record, letting the product make a factual "the AI made you $X" claim that competitors' AI features cannot currently substantiate.
2. **A single config-driven backend serving 42 target industries** instead of a fragmented product-per-vertical strategy — the economics of adding a new industry are "write a config file," not "build a new app," which is structurally faster than how vertical SaaS incumbents operate.
3. **Payments correctness under concurrency** as a first-class engineering property, not a bolted-on Stripe integration.
4. **The AI receptionist answers the phone and actually books real inventory** (jobs/appointments against real availability), not just a chat widget — positioned as the wedge feature against every pure-booking-tool competitor (Jobber, Housecall Pro, Fresha, Booksy, etc.), none of which answer a phone call.
5. **Explicit strategic discipline about what NOT to build** (no POS, no e-commerce, no internal chat, no dental/medical until compliance is done properly) — a maturity signal that the product roadmap is not feature-accumulation-driven.

---

## 29. Current development progress (as of this document)

- **Backend:** substantially built and live in production for the Field Service, generic Property Management, and generic Service Agencies presets; has passed a dedicated multi-phase security/financial-integrity certification pass; is deployed and operating on a Hetzner VPS via Docker Compose with automated migrations.
- **Frontend:** a full premium rebrand and UI rebuild has been completed — public marketing site (landing, features, industries, pricing, demo, resources), authentication pages, and the full "Sofilic OS" authenticated shell with sidebar, dashboard, and all module pages exist and render without errors. However, **a majority of the internal module pages display sample/demo data rather than being wired to the real backend endpoints**, and the frontend's assumption of a rich per-industry navigation config (`preset.navGroups`) currently has no backend counterpart.
- **Product strategy layer:** three planning documents have been produced and approved in sequence — a platform architecture strategy (engines/modules/presets), a full 42-industry blueprint (exact module lists, universal workspace tiering, pricing, navigation spec, roadmap), and a master product audit + 2–3 year roadmap (Horizons 1–3) identifying the "wire the real thing" priority as the highest-leverage near-term work. **None of the Horizon-1 "make it true" implementation work has been started yet** — the platform is currently at the end of the planning phase for that next major push, with only the earlier Phase 1 preset/signup/sidebar-filtering groundwork underway (and, per Section 20, not yet matching its own marketing claims).
- **Deployment operations:** a full production deployment playbook, environment templates, deploy/rollback/smoke-test scripts, and a staging-promotion checklist have been authored and are ready to execute, though the live environment today is the single production VPS rather than a staging+production split.

---

## 30. What another CTO or Product Architect must know before making product decisions

1. **Do not trust what the UI currently shows as evidence of what the backend can do, in either direction.** Some pages showing rich data are backed by nothing (dashboard, dispatch, revenue, reviews). Conversely, some of the most powerful real backend systems (the automation engine, the omnichannel messaging threads, the RAG knowledge base) have almost no UI at all. Any product decision should be made by checking the actual API/service layer, not by clicking through the app.
2. **The industry-preset catalog is the company's core IP and it is currently a fraction of its claimed size.** Any roadmap decision that assumes "16 industries are live" or "42 industries are supported" is working from the marketing narrative, not the current backend reality (3 presets exist). Closing this gap — building out real, distinct presets per named trade rather than one shared generic Field Services config — should be treated as foundational, not cosmetic.
3. **The single highest-leverage near-term work is "wiring," not "building.**" A disproportionate amount of value is available by connecting existing, working backend systems (automations, inbox/messaging, knowledge base, dispatch, revenue/invoices) to their already-designed UI screens, before adding any new feature surface. This was the central conclusion of the most recent audit and should heavily weight any near-term prioritization debate.
4. **The money loop and the team loop are both currently broken end-to-end**, meaning the product cannot today take a real customer from signup to a paying, multi-user, revenue-generating account without manual/engineering intervention. Any go-to-market timeline must account for closing this before it is meaningful to drive signup traffic.
5. **Two engineering strengths (payments integrity, tenant security) are genuinely differentiated and should be protected and referenced in any pitch or diligence conversation** — they represent real, defensible engineering quality, not typical early-stage shortcuts.
6. **The explicit non-goals (no POS, no e-commerce, no PHI-touching features before compliance work, no internal chat) are strategic decisions the founder has already made deliberately and repeatedly** — a new architect proposing work in these areas should understand they are re-opening a settled decision, not filling an oversight.
7. **There is currently no engineering safety net** (no confirmed CI, no error tracking, no staging environment in active use, no feature flags) around a single production server serving what is intended to become the operational system of record for real businesses' revenue and customer data. This should be treated as a risk item independent of any feature roadmap discussion.
