# Sofilic Platform Strategy
### The Business Operating System for Local Businesses
*Chief Product Officer brief — July 2026*

---

## 0. Where we actually stand (honest assessment)

Sofilic today is **not** an HVAC app. Reading the codebase, we already built the correct foundation, mostly by accident of good engineering:

| Asset | What it really is |
|---|---|
| `IndustryModuleConfig` (packages/config) | A **runtime verticalization engine**: vocabulary, pipeline stages, job statuses, intake questions, document templates and automation presets all load per-tenant from config. Changing a tenant's module re-skins the whole product with zero code changes. |
| Generic data model (Lead / Job / Contact / Document / Payment) | Industry-neutral. A "lead" is a salon booking request, a burst pipe, or a legal intake — the backing model doesn't care. |
| AI workforce + value ledger | Universal by design. Sales AI, Collections AI, Receptionist work for any business that has leads and invoices. |
| Scheduling engine (working hours, slots, conflict-free booking, calendar) | Already 70% of an appointment-industry engine. |
| Omnichannel (voice/SMS/chat/email), portal, payments, analytics, automations | All industry-neutral already. |

**The strategic conclusion: we don't pivot the product. We scale the config layer and fill three engine gaps.** Nothing gets duplicated.

---

## 1. The architecture: Engine → Module → Preset

The mistake to avoid: treating "40 industries" as 40 modules. Local businesses collapse into **four operational patterns** ("engines") based on one question: *where and how does the work happen?*

```
SOFILIC CORE  (every tenant, always on)
  Dashboard · CRM · Customers · AI Assistant · Calendar · Tasks
  Communication · Documents · Billing · Analytics · Automation
  Marketing · Settings
        │
        ├── ENGINE: DISPATCH      (we go to the customer)
        ├── ENGINE: APPOINTMENT   (customer comes to us / books a slot)
        ├── ENGINE: CASE          (work is a matter that lives for weeks/months)
        └── ENGINE: COVERAGE      (continuous shifts at customer sites)
                │
                └── INDUSTRY PRESET  (vocabulary, pipeline labels, intake
                    questions, doc templates, automation recipes, demo data)
```

- **Engine** = real functionality (code). There are only 4. One is fully built, one is 70% built, two are partial.
- **Preset** = pure config (no code). "Plumbing" vs "HVAC" vs "Locksmith" differ only in words, templates, and seeded automations. A new preset costs **hours, not weeks** — this is our unfair economics.
- Signup asks: Business name → Country → Industry → Business size → Team size. Industry selects the preset; preset selects the engine; the workspace loads looking purpose-built.

### Which industries share which engine

| Engine | Industries | Status |
|---|---|---|
| **DISPATCH** | HVAC, Plumbing, Electrical, Roofing, Landscaping, Cleaning, Pest Control, Garage Door, Appliance Repair, Locksmith, Painting, Pressure Washing, Window Cleaning, Junk Removal, Dog Walking, Mobile Detailing, Property Maintenance | ✅ **Built** (current FIELD_SERVICES) |
| **APPOINTMENT** | Hair Salon, Barbershop, Spa, Nail Salon, Beauty Clinic, Dental, Medical Clinic, Physio, Chiropractic, Repair Shop, Body Shop, Tire Shop, Detailing (in-shop), Gym, Personal Trainer, Yoga, Martial Arts, Pet Grooming, Veterinary, Pet Boarding | 🟡 70% (scheduling exists; needs **bookable resources** — chair/bay/room/table — recurring appointments, no-show flow, class/group bookings) |
| **CASE** | Law Firm, Accounting, Consulting, Marketing Agency, Real Estate Agency, Home Care coordination | 🟡 60% (current SERVICE_AGENCIES; needs matter timeline, retainer billing, milestone tracking) |
| **COVERAGE** | Guard Companies, Mobile Patrol, Alarm Response, Event Security, Facility Management, Condo Management, Home Care delivery | 🟡 50% (field app + scheduling exist; needs **sites**, shift rosters, checkpoint/incident reports) |

Property Management is a hybrid (COVERAGE for sites + DISPATCH for work orders) — it composes the two engines rather than getting its own.

Key rule: **an engine is only built once, and every industry that lands on it inherits every improvement forever.**

---

## 2. Which industries first (market-driven ranking)

Ranking criteria: software spend willingness × business count × competitor weakness × distance from what we've built × compliance drag.

### Tier 1 — Now (Phase 1): Own the DISPATCH beachhead
**HVAC, Plumbing, Electrical, Cleaning, Landscaping, Pest Control, Appliance Repair, Roofing, Garage Door, Locksmith, Painting, Pressure Washing, Window Cleaning, Junk Removal**

- Highest validated software spend in local business ($150–600/mo: ServiceTitan, Jobber, Housecall Pro prove the budget exists).
- Urgent, high-ticket jobs → missed-call text-back and AI receptionist have *provable* ROI within days. Our strongest existing features are their biggest pains.
- **The engine is already live.** All 14 sub-industries are presets on FIELD_SERVICES — roughly a day of config work each including templates and demo data. Fourteen "purpose-built products" for two weeks of effort is the best ROI decision available to us.

### Tier 2 — Next (Phase 2): APPOINTMENT engine unlocks the volume markets
**Beauty (salon, barber, spa, nails), Automotive (repair, tire, detailing, body), Pet (grooming, boarding, walking), Fitness (gym, PT, yoga, martial arts)**

- Beauty + fitness + pet = the largest *count* of local businesses; automotive has the strongest per-seat pricing tolerance (Shopmonkey/Tekmetric at $300–500/mo).
- Incumbents (Fresha, Booksy, Mindbody, Vagaro) are booking tools with weak/no AI, no unified comms, no review automation, and widely resented pricing models. Our wedge: "your booking tool doesn't answer your phone at 9pm. Sofilic does."
- One engine build (bookable resources + recurring + group bookings + no-show automation) unlocks ~20 industries simultaneously.

### Tier 3 — Later (Phase 3): CASE + COVERAGE depth
**Professional services (law, accounting, consulting, agencies, real estate), Security (guards, patrol, events), Facility/Condo Management**

- Higher contract values, longer sales cycles, more referenceability. Security and facility management are genuinely underserved (Silvertrac/TrackTik are dated).
- These buyers demand maturity — better to arrive with a polished core and case studies from Tiers 1–2.

### Tier 4 — Deliberate delay: Healthcare & Hospitality
- **Healthcare (dental, medical, physio, chiro, home care):** highest willingness to pay, but PHI compliance (HIPAA/PHIPA) touches data handling, AI processing, audit, BAAs, and hosting. Do it once we can do it properly — entering early and cheaply is how platforms get banned from the vertical. Physio/chiro/wellness first (lighter regime), dental/medical after a real compliance workstream.
- **Hospitality (restaurant, cafe, bakery, food truck):** the buyer's core system is a POS (Toast, Square). We would be a satellite app, not the operating system — violates our own thesis. **Revisit only** as a reservations + reviews + marketing play, never as ops.

---

## 3. Module matrix (what each industry sees)

**Core (all tenants, non-removable):** Dashboard, CRM, Customers, AI Assistant, Calendar, Tasks, Communication, Documents, Billing, Analytics, Automation, Marketing, Settings.

**Engine modules (loaded by industry):**

| Module | DISPATCH | APPOINTMENT | CASE | COVERAGE |
|---|---|---|---|---|
| Pipeline (industry-labeled) | ✅ | ✅ | ✅ (matters) | ✅ (contracts) |
| Smart Dispatch / assignment | ✅ | — | — | ✅ (post assignment) |
| Field Team app + copilot | ✅ | — | — | ✅ (guard/carer app) |
| Booking page + resources (chairs/bays/rooms) | — | ✅ | — | — |
| Recurring appointments / memberships | optional | ✅ | ✅ (retainers) | — |
| Job / work-order tracking | ✅ | light | — | ✅ (incidents) |
| Matter timeline + milestones | — | — | ✅ | — |
| Sites + shift roster + checkpoint reports | — | — | — | ✅ |
| Quotes → Invoices | ✅ | light | ✅ | ✅ |
| Customer Portal | ✅ | ✅ | ✅ (client portal) | ✅ (site portal) |

The rule the user set, enforced structurally: a salon literally cannot see Patrol Reports because its preset never mounts the COVERAGE engine. No feature-flag spaghetti — module mounting is driven by the same config object that already drives vocabulary.

---

## 4. Universal workspaces — build order by the Product Rule

Scored against: replaces paid software / saves weekly time / increases revenue / reduces manual work / improves CX.

| Workspace | Verdict | Reasoning |
|---|---|---|
| **Reviews** | 🥇 **Build first** | Replaces Podium/Birdeye ($300–500/mo). Automated post-job review requests already exist; add Google/Facebook review ingestion, AI reply generator, reputation score. Direct revenue impact for *every* industry. The single highest-leverage workspace we can ship. |
| **Communication** | 🥈 Mostly built — unify | Voice/SMS/chat/email threads already exist in the backend. Product work is one inbox UI. Replaces separate texting tools. Skip internal team chat in v1 (see kill list). |
| **Knowledge (AI Company Brain)** | 🥉 Repackage, don't build | The pgvector RAG "Business Brain" is already in the codebase. Surface it: upload SOPs → staff and AI employees answer from it. Near-zero backend work, large perceived value. |
| **Documents** | Built — polish | Quotes, invoices, contracts, forms already exist. Add a template gallery per preset. |
| **Marketing** | Phase 2 — scoped | Start with Google Business Profile + Facebook/Instagram posting + AI post generator fed by real business events ("just finished this roof in Eastside" → post). This is differentiated: our posts come from *operational data*, which Buffer/Hootsuite can't do. Campaign calendar + brand kit later. TikTok/LinkedIn later (see kill list). |
| **Media** | ❌ Not a workspace | Photos/videos matter *attached to jobs and posts* (before/after photos are field-service gold), not as a standalone file manager. Fold into Documents + job records. Google Drive already exists; replacing it satisfies none of the five criteria. |

---

## 5. Biggest competitive advantages (defend these)

1. **The AI workforce with a P&L.** Every AI employee's actions land in the value ledger — we can show an owner "Sofilic made you $3,120 this month" on real settlement data. No incumbent in any of our verticals can print that number. This is the demo that closes deals and the retention lock.
2. **AI receptionist + missed-call text-back for local business.** The universal bleeding neck: local businesses miss 30–40% of calls, and a missed call is lost revenue that same day. Works identically for a plumber and a salon.
3. **Preset economics.** Competitors need quarters to enter a vertical; we need a config file. We can launch "Sofilic for Locksmiths" as a landing page + preset in a week and let demand data tell us where to dig deeper.
4. **One login replacing 5–7 subscriptions.** Jobber + Podium + Calendly + QuickBooks-adjacent invoicing + Mailchimp + a phone system ≈ $500–900/mo fragmented. The consolidation pitch *is* the Business OS pitch.
5. **Operational data → marketing content.** Completed jobs generate review requests, before/after posts, and re-engagement campaigns automatically. Only possible because ops and marketing live in one system.

---

## 6. Kill list (do not build)

| Idea | Why not |
|---|---|
| Hospitality ops (POS, tables, kitchen) | POS is the OS there; we'd be a satellite. Fails our own thesis. |
| Internal team chat | Slack/WhatsApp are free and entrenched; zero differentiation; high build cost. Job-level comments cover the real need. |
| Standalone Media workspace | Fails all five product-rule criteria (above). |
| TikTok + LinkedIn publishing in v1 | Local business marketing lives on Google Business Profile, Facebook, Instagram. TikTok ROI for a plumber is folklore; LinkedIn is for us, not our customers. Add later behind demand data. |
| Third-party marketplace apps/SDK | Marketplace stays first-party (our AI employees, presets, workflow packs) until we have platform-scale demand. External developer programs are a company-sized commitment. |
| Custom AI-employee builder | Powerful but premature; our packaged employees with authority levels cover 95% of needs. Roadmap "Later." |
| Dental/medical before a compliance workstream | PHI without BAAs and audited handling is an existential risk, not a feature gap. |
| Per-industry mobile apps | One field/staff app driven by the same config layer. |

---

## 7. Phased roadmap

### Phase 1 — "Own the trades" (Weeks 1–8)
*Zero new engines. Config + two workspaces.*
- Formalize `engine` field in IndustryModuleConfig; split taxonomy into engine → module → preset.
- Ship **14 DISPATCH presets** (HVAC, Plumbing, Electrical, Roofing, Landscaping, Cleaning, Pest Control, Garage Door, Appliance Repair, Locksmith, Painting, Pressure Washing, Window Cleaning, Junk Removal) with vocabulary, templates, automations, demo data each.
- New signup flow: Business name → Country → Industry (searchable, all presets) → Business size → Team size.
- **Reviews workspace** (ingestion, AI replies, reputation score) — the Podium killer.
- **Communication inbox** unification UI.
- Marketing site: industry landing pages generated from preset data ("Sofilic for Plumbers").

**Exit criteria:** a plumber, cleaner, and locksmith each sign up and see a product that feels built for them; reviews workspace live for all.

### Phase 2 — "The appointment economy" (Months 3–6)
*One engine build unlocks ~20 industries.*
- **APPOINTMENT engine:** bookable resources (chair/bay/room), public booking page, recurring appointments, group/class bookings, no-show + reminder automation flows.
- Presets: Hair Salon, Barbershop, Spa, Nails, Auto Repair, Tire Shop, Detailing, Pet Grooming, Veterinary (non-clinical records), Gym, Personal Trainer, Yoga, Martial Arts.
- **Marketing workspace v1:** GBP + Facebook/Instagram + AI post generator wired to operational events; campaign calendar.
- AI receptionist tuned for booking conversations (reschedule, waitlist).

**Exit criteria:** a salon can run its whole front desk (booking, reminders, reviews, marketing) on Sofilic.

### Phase 3 — "Serious operations" (Months 6–12)
- **COVERAGE engine:** sites, shift rosters, checkpoint/incident reports, site portal → Security (guards, patrol, alarm response, events), Facility/Condo Management; compose with DISPATCH for full Property Management.
- **CASE engine depth:** matter timelines, retainer billing, milestone automation → Law, Accounting, Consulting, Agencies, Real Estate.
- Knowledge workspace (surface the existing AI Business Brain).
- Physio/chiro/wellness presets (light-compliance healthcare beachhead).

### Phase 4 — "Regulated + platform" (Year 2)
- Healthcare compliance workstream (BAAs, PHI handling, audit) → Dental, Medical Clinic, Home Care.
- Marketplace expansion, custom AI-employee builder, multi-location/franchise management.
- Hospitality go/no-go decision based on data — as marketing/reviews/reservations only, never ops.

---

## 8. The one-sentence strategy

**Sofilic wins by building four operational engines once, stamping out industries as configuration, and letting an AI workforce with a provable P&L replace the 5–7 subscriptions every local business already pays for.**
