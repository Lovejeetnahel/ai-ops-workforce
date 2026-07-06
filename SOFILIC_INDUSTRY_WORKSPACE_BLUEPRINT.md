# SOFILIC — Industry → Engine → Module → Workspace Blueprint
### The Business Operating System for Local Businesses
*CPO / Product Architecture — July 2026. Companion to SOFILIC_PRODUCT_STRATEGY.md.*

**Ground rules honored throughout:** nothing existing is deleted. The current backend (NestJS, generic Lead/Job/Contact/Document/Payment model, tenant isolation, AI workforce, value ledger, automations, scheduling, omnichannel, marketplace) and the current `IndustryModuleConfig` system are the foundation. This document defines how that foundation scales to 42 industries via configuration and four targeted engine builds — one platform, one backend, one AI, one billing, different experience per industry.

**The layering:**

```
TECHNICAL CORES (code — build once)
  DISPATCH · APPOINTMENT · COVERAGE · CASE · COMMERCE
        ↓ power
BUSINESS ENGINES (12 — commercial packaging & GTM)
        ↓ contain
INDUSTRY PRESETS (42 — pure config: vocabulary, modules,
  widgets, automations, templates, demo data)
        ↓ mount
MODULES (sidebar items) + UNIVERSAL WORKSPACES (opt-in per preset)
```

A preset declares: `engine`, `modules[]`, `workspaces[]`, `vocabulary`, `pipeline`, `intakeFields`, `documentTemplates`, `automationPresets`, `dashboardWidgets`, `hiddenModules[]`. The sidebar, dashboard and AI behavior all read from it at runtime — exactly how `IndustryModuleConfig` works today, extended with `modules`, `workspaces` and `dashboardWidgets` keys.

---

# PART 1 — BUSINESS ENGINES

Twelve commercial engines, powered by five technical cores. "Core" tells engineering what to build; "Engine" tells sales what to sell.

---

## 1. Field Service Engine  `core: DISPATCH`  ✅ built
- **Businesses:** HVAC, plumbing, electrical, roofing, landscaping, cleaning, pest control, garage door, appliance repair, locksmith, painting, pressure washing, window cleaning, junk removal.
- **Core workflow:** lead (call/chat/form) → AI qualifies & triages urgency → quote → schedule → dispatch tech by skill/zone → job done on field app → invoice + pay link → review request → re-engagement.
- **Daily roles:** Owner/operator, dispatcher/CSR, field technician, (bookkeeper part-time).
- **Revenue model:** per-job invoicing; some maintenance contracts (recurring).
- **Required modules:** Pipeline, Jobs, Dispatch, Schedule, Field App, Quotes/Invoices, Customers, Payments.
- **Optional modules:** Maintenance Plans (recurring), Fleet, Inventory (parts), Zones.
- **AI opportunities:** AI receptionist (24/7 booking), missed-call text-back, emergency triage, quote follow-up AI, collections AI, before/after photo → marketing post.
- **Why it matters:** highest proven software spend in local business; our engine is already live; urgent high-ticket jobs make AI ROI provable in days. **This is the beachhead.**

## 2. Appointment Engine  `core: APPOINTMENT`  🟡 to build (Phase 2)
- **Businesses:** any business where the customer books a time slot with a person/resource — beauty, wellness, clinics, studios, groomers, in-shop auto.
- **Core workflow:** client books (page/phone/AI) → slot on a bookable resource (person + chair/room/bay) → reminders kill no-shows → service delivered → checkout (tips, packages) → rebook prompt → review.
- **Daily roles:** Owner, front desk, service providers (stylist/therapist/trainer/tech).
- **Revenue model:** per-service, packages, memberships, retail add-ons.
- **Required modules:** Appointments (calendar-first), Resources, Services & Pricing, Clients, Payments/Checkout, Booking Page.
- **Optional modules:** Memberships/Packages, Waitlist, Inventory (retail), Gift Cards.
- **AI opportunities:** AI phone booking (the killer feature — Fresha/Booksy can't answer a phone), no-show prediction, smart rebooking prompts, slow-day fill campaigns.
- **Why it matters:** the largest *count* of local businesses; one engine build unlocks ~20 industries; incumbents are booking tools, not operating systems.

## 3. Coverage / Security Engine  `core: COVERAGE`  🟡 to build (Phase 3)
- **Businesses:** guard companies, mobile patrol, alarm response, event security.
- **Core workflow:** win site contract → build shift roster → guards clock in at site (geo-verified) → patrol tours with checkpoints → incidents & daily activity reports (DAR) → client gets site portal → hours roll into payroll export + invoice.
- **Daily roles:** Owner, operations manager, supervisors, guards, client contacts.
- **Revenue model:** contracted hours billed monthly; event one-offs.
- **Required modules:** Sites, Shifts/Roster, Guards, Patrol Tours, Checkpoints, DAR Reports, Incidents, Client Portal, Payroll Export, Invoices.
- **Optional modules:** Equipment Issue Tracking, Certifications/Licensing, Event Staffing.
- **AI opportunities:** AI-written DAR summaries from checkpoint pings, incident report drafting, shift-gap prediction and auto-offer to available guards, client-facing monthly AI summary.
- **Why it matters:** underserved (incumbents dated), sticky multi-year contracts, high seat counts.

## 4. Property / Facility Engine  `core: COVERAGE + DISPATCH composite`  🟡 Phase 3
- **Businesses:** property management, condo/HOA management, facility management.
- **Core workflow:** manage properties/units → tenant submits maintenance request via portal → triage → dispatch internal tech or vendor → track to completion → owner/board reporting; parallel track: leases, rent tracking, notices, inspections.
- **Daily roles:** Property manager, maintenance coordinator, techs/vendors, tenants, owners/boards.
- **Revenue model:** % of rent or per-door fee; facility contracts.
- **Required modules:** Properties, Units, Tenants, Leases, Maintenance Requests, Vendors, Inspections, Rent Tracking, Owner Reports, Notices.
- **Optional modules:** Board/AGM tools (condo), Amenity Booking, Violation Tracking.
- **AI opportunities:** AI triage of tenant requests (urgency + trade), lease renewal prediction, owner report generation, arrears follow-up AI.
- **Why it matters:** recurring revenue per door, extreme stickiness, composable from two cores we already need.

## 5. Case / Professional Services Engine  `core: CASE`  🟡 60% (SERVICE_AGENCIES today)
- **Businesses:** law, accounting, consulting, marketing agencies, real estate brokerage.
- **Core workflow:** inquiry → conflict/fit check → engagement letter → matter/engagement opens → milestones, tasks, documents, time → interim/retainer billing → close → referral ask.
- **Daily roles:** Partners/principals, associates, admin/paralegal, clients.
- **Revenue model:** hourly, retainer, flat-fee, commission (real estate).
- **Required modules:** Matters/Engagements, Milestones, Time Tracking, Retainers, Client Portal, Documents (heavy), Tasks.
- **Optional modules:** Trust Accounting note (integrations, not custody), Deal Rooms (real estate), Proposal Builder.
- **AI opportunities:** intake qualification, document drafting from templates, time-entry capture from activity, engagement status summaries for clients.
- **Why it matters:** highest revenue per client; document + AI leverage is enormous; longer sales cycle → Phase 3.

## 6. Hospitality Engine  `core: COMMERCE (thin)`  ⛔ deliberately minimal
- **Businesses:** restaurant, cafe, bakery, food truck.
- **Position (unchanged from strategy doc):** the POS is the operating system here — we do not compete with Toast/Square. Sofilic serves hospitality as **Reviews + Marketing + Communication + simple Reservations/Pre-orders**, i.e. mostly universal workspaces plus a thin booking layer.
- **Core workflow (our slice):** review ingestion & AI replies → social posts from menu/events → reservation or catering inquiry → SMS confirmations → loyalty re-engagement.
- **Daily roles:** Owner/manager (single buyer persona).
- **Revenue model (theirs):** covers/orders; (ours): flat SaaS on marketing/reputation value.
- **Required modules:** Reservations/Inquiries (thin), Reviews, Marketing, Communication.
- **Optional:** Catering Pipeline (uses CASE-lite), Loyalty campaigns.
- **AI opportunities:** review reply AI, social content from menu photos, catering inquiry qualification.
- **Why it matters commercially:** huge volume of businesses and the cheapest CAC for our reputation/marketing stack — a wedge product, not an ops platform. Sold as "Sofilic Marketing" tier.

## 7. Automotive Engine  `core: APPOINTMENT + work orders`  🟡 Phase 2
- **Businesses:** repair shops, mechanics, body shops, tire shops, detailing.
- **Core workflow:** booking (bay + tech) → vehicle intake (VIN, photos) → digital inspection → estimate approval by text → work order → parts → completion → payment → service reminder by mileage/season.
- **Daily roles:** Owner, service advisor, technicians.
- **Revenue model:** per-RO (repair order) parts + labor.
- **Required modules:** Appointments (bays), Vehicles, Work Orders, Estimates w/ approval, Inspections, Customers, Payments.
- **Optional:** Parts Inventory, Tire Storage (tire shops), Loaner Tracking.
- **AI opportunities:** estimate follow-up AI ("your brake quote expires"), AI service advisor (explains repairs in plain language via SMS), seasonal campaign AI (winter tires).
- **Why it matters:** proven $300–500/mo spend (Shopmonkey/Tekmetric), high ticket, weak AI incumbents.

## 8. Health & Wellness Engine  `core: APPOINTMENT + records`  🟠 Phase 3 (light) / Phase 4 (regulated)
- **Businesses:** physio, chiropractic (Phase 3); dental, medical clinics, home care (Phase 4 after compliance).
- **Core workflow:** referral/booking → intake forms → appointment series (treatment plans) → SOAP-style visit notes → insurance-ready invoices → recall/reactivation.
- **Daily roles:** Practitioners, front desk, clinic manager; carers + coordinators (home care).
- **Revenue model:** per-visit, treatment plans, insurance billing.
- **Required modules:** Appointments, Patients, Intake Forms, Treatment Plans, Visit Notes, Recalls, Invoices.
- **Compliance gate:** PHI handling, BAAs, audit, consent — a real workstream before dental/medical launch. Physio/chiro/wellness first under the lighter regime.
- **AI opportunities:** recall prediction, no-show prevention, note summarization (with strict PHI boundaries), insurance claim prep.
- **Why it matters:** highest willingness to pay in the list; must be earned with compliance, not rushed.

## 9. Beauty Engine  `core: APPOINTMENT`  🟡 Phase 2
- **Businesses:** hair salons, barbershops, nail salons, spas, beauty clinics.
- **Core workflow:** book (stylist + chair) → reminders → service + upsell → checkout with tips/retail → rebook in 4–6 weeks → before/after content → reviews.
- **Daily roles:** Owner-operator, stylists/techs (often booth renters), front desk.
- **Revenue model:** per-service, packages, memberships, retail; booth-rent management.
- **Required modules:** Appointments, Staff & Chairs, Services Menu, Clients (with formulas/preferences), Checkout, Booking Page.
- **Optional:** Memberships, Gift Cards, Retail Inventory, Booth Rent tracking, Before/After Gallery.
- **AI opportunities:** AI phone/DM booking, rebooking nudges timed to service cycle, social posts from before/after photos, slow-slot flash campaigns.
- **Why it matters:** massive business count; incumbents monetize via marketplace commissions salon owners resent; "we don't take a cut of your clients" is a killer pitch.

## 10. Fitness Engine  `core: APPOINTMENT + memberships/classes`  🟡 Phase 2
- **Businesses:** gyms, yoga studios, personal trainers, martial arts.
- **Core workflow:** trial/drop-in → membership signup → class schedule + capacity booking → check-in → retention monitoring → win-back campaigns; PT: session packs.
- **Daily roles:** Owner, instructors/trainers, front desk.
- **Revenue model:** recurring memberships (the key difference), class packs, PT sessions.
- **Required modules:** Class Schedule, Memberships (recurring billing), Check-in, Members, Instructors, Booking Page.
- **Optional:** Belt/Progress Tracking (martial arts), Workout Plans (PT), Waivers.
- **AI opportunities:** churn prediction from attendance decay, win-back AI, trial-to-member conversion follow-up, class-fill campaigns.
- **Why it matters:** recurring revenue businesses value retention tooling; Mindbody fatigue is real and loud.

## 11. Pet Services Engine  `core: APPOINTMENT / DISPATCH mix`  🟡 Phase 2
- **Businesses:** grooming (appointment), veterinary (appointment + records), dog walking (dispatch), boarding (reservation/capacity).
- **Core workflow:** pet profile (breed, temperament, vaccines) → book service → reminders w/ vaccine checks → service + report card w/ photos → rebook cycle.
- **Daily roles:** Owner, groomers/walkers/vets, front desk.
- **Revenue model:** per-service, packages, recurring walks, boarding nights.
- **Required modules:** Appointments/Visits, Pets (profiles + vaccine records), Owners, Report Cards, Booking Page.
- **Optional:** Boarding Calendar (capacity), Walk Routes (dispatch core), Vaccine Reminders, Retail.
- **AI opportunities:** photo report cards auto-drafted, vaccine expiry campaigns, rebooking cycles per breed/coat.
- **Why it matters:** fast-growing spend category, emotionally engaged customers (reviews/photos gold), underserved by modern software.

## 12. Retail / Local Commerce Engine  `core: COMMERCE`  ⛔ Phase 4+ / thin only
- **Businesses:** local shops, studios with retail (photography print sales), bakeries' order-ahead.
- **Position:** we do not build POS or e-commerce (Shopify/Square own it). We serve retail-adjacent needs of our existing industries: product/retail inventory add-on, order/pickup requests, and the universal marketing/reviews/communication stack. Standalone retail is **not a target segment** until platform maturity.
- **Required modules (as add-on to other engines):** Inventory (retail), Orders/Pickups (thin), Gift Cards.
- **AI opportunities:** restock alerts, product post generator.
- **Why it exists:** lets salons/gyms/groomers/bakeries sell product without leaving Sofilic — an ARPU expander, not an engine to lead with.

---

### Engine → technical core summary

| Technical core | Status | Business engines it powers |
|---|---|---|
| DISPATCH | ✅ built | Field Service; parts of Property, Pet (walking) |
| APPOINTMENT | 🟡 Phase 2 | Appointment, Beauty, Fitness, Automotive, Pet, Health & Wellness |
| COVERAGE | 🟡 Phase 3 | Coverage/Security; parts of Property/Facility, Home Care |
| CASE | 🟡 Phase 3 | Professional Services; Catering pipeline |
| COMMERCE (thin) | ⛔ minimal | Hospitality slice, Retail add-on |

---

# PART 2 — 42 INDUSTRIES: EXACT MODULES

Format per industry — **Sidebar** (what they see, grouped per Part 5), **Widgets** (dashboard), **Workflows**, **AI**, **Automations**, **Docs**, **KPIs**, **Workspaces** (universal ones enabled beyond defaults), **Hidden** (never mounted).

Shared baseline for ALL industries (never repeated below): Dashboard, Customers/CRM, Calendar, Tasks, Communication Inbox, Documents, Invoices & Payments, Automations, Analytics, Settings. Universal workspaces Reviews + Communication + Documents + Automation + Analytics + AI Workforce are on for everyone.

---

## ENGINE: FIELD SERVICE (DISPATCH core — presets ship Phase 1)

### 1. HVAC
- **Sidebar:** Pipeline (New Request→Quoted→Scheduled→Completed) · Jobs · Dispatch Board · Schedule · Field App · Quotes · Maintenance Plans · Equipment Records (per address) · Zones
- **Widgets:** Today's revenue · Emergency calls open · Techs on site map · Quote pipeline value · Maintenance renewals due · Review score
- **Workflows:** emergency triage fast-track; quote→approve-by-SMS→schedule; seasonal tune-up campaigns; equipment history per home
- **AI:** receptionist books with urgency triage ("no cooling" = emergency); copilot surfaces unit model/history on site
- **Automations:** missed-call text-back · emergency dispatch alert · quote follow-up (48h/7d) · post-job review · spring/fall tune-up campaign · maintenance renewal 30d before
- **Docs:** Estimate · Invoice · Maintenance Agreement · Equipment Inspection Report · Refrigerant Log
- **KPIs:** avg ticket · quote win rate · time-to-dispatch · maintenance plan attach rate · revenue per tech
- **Workspaces:** + Voice · Marketing · Fleet · Inventory (parts)
- **Hidden:** Chairs/Resources · Patrol/Sites · Leases/Units · Matters · Class schedule · Boarding

### 2. Plumbing
- **Sidebar:** Pipeline · Jobs · Dispatch Board · Schedule · Field App · Quotes · Service Agreements · Zones
- **Widgets:** Emergency queue · Today's jobs map · Outstanding invoices · Quote pipeline · Review score
- **Workflows:** emergency (burst/leak) fast-track; camera-inspection upsell flow; permit-required job flag
- **AI:** receptionist triages water-emergency vs quote request; photo-based pre-diagnosis from customer MMS
- **Automations:** missed-call text-back · emergency alert · quote follow-up · review request · annual water-heater check campaign
- **Docs:** Estimate · Invoice · Camera Inspection Report · Permit Checklist · Service Agreement
- **KPIs:** emergency response time · avg ticket · drain-vs-install revenue mix · callback rate
- **Workspaces:** + Voice · Marketing · Fleet · Inventory
- **Hidden:** as HVAC

### 3. Electrical
- **Sidebar:** Pipeline · Jobs · Dispatch Board · Schedule · Field App · Quotes · Permits & Inspections · Zones
- **Widgets:** Jobs today · Permit status board · Quote pipeline · Panel-upgrade leads · Review score
- **Workflows:** permit tracking per job; safety inspection checklist; EV-charger install pipeline (growing segment)
- **AI:** receptionist distinguishes no-power emergency vs project quote; copilot surfaces code requirements by jurisdiction (from Knowledge brain)
- **Automations:** missed-call text-back · quote follow-up · inspection reminder · review request · EV charger campaign to past customers
- **Docs:** Estimate · Invoice · Electrical Safety Certificate · Permit Application Checklist · Panel Inspection Report
- **KPIs:** quote win rate · service vs project revenue · permit cycle time · revenue per electrician
- **Workspaces:** + Voice · Marketing · Fleet · Inventory
- **Hidden:** as HVAC

### 4. Roofing
- **Sidebar:** Pipeline (Inspection→Quote→Insurance→Scheduled→Complete) · Jobs · Schedule · Field App · Quotes · Insurance Claims Tracker · Material Orders
- **Widgets:** Inspections booked · Insurance claims in progress · Weather delay flags · Quote pipeline value · Crew schedule
- **Workflows:** photo inspection → report → insurance documentation → material order → multi-day crew job; storm-response surge mode
- **AI:** photo-report drafting from inspection images; insurance documentation assistant; storm-area lead prioritization
- **Automations:** inspection follow-up · insurance status nudges · weather-reschedule notice · review request · storm-season campaign
- **Docs:** Inspection Report (photo-heavy) · Estimate · Insurance Supplement · Material Order Sheet · Warranty Certificate
- **KPIs:** inspection→contract rate · avg contract value · days-to-close · insurance vs retail mix
- **Workspaces:** + Voice · Marketing · Fleet
- **Hidden:** as HVAC + Maintenance Plans (rare)

### 5. Cleaning Services
- **Sidebar:** Pipeline · Jobs (recurring-first) · Schedule (recurring routes) · Teams · Field App · Quotes · Checklists · Client Preferences
- **Widgets:** Today's route board · Recurring revenue · Missed/rescheduled cleans · Quality scores · New quote requests
- **Workflows:** recurring schedule engine (weekly/biweekly); team-based assignment; quality checklist per clean with photos; key/access notes
- **AI:** receptionist books estimates + handles reschedules; quality-issue detection from checklist patterns
- **Automations:** day-before reminder · on-the-way text · post-clean checklist to client · review request · win-back for paused clients · rebooking for one-time deep cleans
- **Docs:** Quote (by sqft/rooms) · Invoice · Cleaning Checklist · Service Agreement · Key Release Form
- **KPIs:** recurring client count & churn · revenue per crew-hour · fill rate · complaint rate
- **Workspaces:** + Voice · Marketing · HR (crews, high turnover)
- **Hidden:** Emergency framing · Equipment records · Insurance claims

### 6. Landscaping
- **Sidebar:** Pipeline · Jobs · Route Schedule (seasonal recurring) · Crews · Field App · Quotes · Seasonal Contracts · Properties Served
- **Widgets:** Today's routes · Seasonal contract renewals · Weather hold list · Quote pipeline · Crew hours
- **Workflows:** seasonal contracts (mowing season, snow season); route-day optimization; weather rescheduling en masse
- **AI:** photo-based quote assistance; seasonal transition campaigns ("book fall cleanup")
- **Automations:** season renewal 45d before · weather-hold broadcast · route-day reminder · review request · snow/lawn cross-sell
- **Docs:** Seasonal Contract · Quote · Invoice · Property Service Notes
- **KPIs:** contract renewal rate · revenue per route-hour · seasonal mix · drive-time ratio
- **Workspaces:** + Marketing · Fleet · HR
- **Hidden:** Emergency triage · Insurance claims · Equipment records

### 7. Pest Control
- **Sidebar:** Pipeline · Jobs · Schedule (recurring treatments) · Field App · Quotes · Treatment Plans · Chemical Log · Zones
- **Widgets:** Today's treatments · Recurring plan MRR · Re-treatment callbacks · Quote pipeline · Compliance log status
- **Workflows:** initial treatment → recurring quarterly plan; chemical application logging (regulatory); re-treatment guarantee handling
- **AI:** receptionist triages infestations (species → service type); treatment report drafting
- **Automations:** treatment reminder · post-treatment instructions SMS · recurring plan billing · review request · seasonal campaigns (ants spring, rodents fall)
- **Docs:** Treatment Report · Chemical Application Log · Service Plan Agreement · Invoice · WDI Inspection Report
- **KPIs:** recurring plan attach rate · plan churn · callbacks per 100 treatments · revenue per tech-day
- **Workspaces:** + Voice · Marketing · Fleet · Inventory (chemicals)
- **Hidden:** Insurance claims · Maintenance plans (replaced by Treatment Plans)

### 8. Locksmith
- **Sidebar:** Pipeline · Jobs · Dispatch Board (speed-first) · Schedule · Field App · Quotes · Key/Code Records (secure)
- **Widgets:** Live emergency queue · Avg response time today · Jobs by type (lockout/rekey/install) · Tech locations · Review score
- **Workflows:** lockout emergency dispatch (minutes matter); ID-verification protocol at door; commercial master-key projects
- **AI:** receptionist handles panicked lockout calls, quotes ranges, dispatches nearest tech, sends ETA + tech photo
- **Automations:** missed-call text-back (critical — lockouts call the next locksmith in 60s) · ETA updates · review request · rekey-after-moving campaign to real-estate partners
- **Docs:** Invoice · Work Authorization (ID verification) · Master Key Agreement · Security Upgrade Quote
- **KPIs:** response time · answer rate · avg ticket · emergency vs scheduled mix
- **Workspaces:** + Voice (essential) · Marketing
- **Hidden:** Maintenance plans · Insurance claims · Recurring schedules · Crews

### 9. Appliance Repair
- **Sidebar:** Pipeline · Jobs · Dispatch Board · Schedule · Field App · Quotes · Appliance Records (make/model/serial) · Parts Orders
- **Widgets:** Today's calls · Parts-waiting jobs · First-visit-fix rate · Quote approvals pending · Review score
- **Workflows:** diagnose visit → parts order → return visit (existing ON_HOLD = "Awaiting Parts"); warranty vs COD jobs
- **AI:** model-number lookup → likely fault + parts (Knowledge brain); pre-visit triage by customer photo/video
- **Automations:** parts-arrived → auto-offer return slot · diagnosis fee credit on repair · review request · extended warranty campaign
- **Docs:** Diagnosis Report · Estimate · Invoice · Warranty Claim Form
- **KPIs:** first-visit-fix rate · parts turnaround · diagnosis→repair conversion · revenue per tech
- **Workspaces:** + Voice · Inventory (parts) · Marketing
- **Hidden:** Crews · Seasonal contracts · Insurance claims

### 10. Garage Door Services
- **Sidebar:** Pipeline · Jobs · Dispatch Board · Schedule · Field App · Quotes · Door/Opener Records · Zones
- **Widgets:** Emergency queue (door stuck open = security issue) · Installs vs repairs today · Quote pipeline · Review score
- **Workflows:** emergency repair fast-track; install projects with measure visit; spring-replacement safety upsell
- **AI:** photo triage (broken spring identifiable) → accurate quote before dispatch
- **Automations:** missed-call text-back · quote follow-up · annual tune-up campaign · review request
- **Docs:** Estimate · Invoice · Safety Inspection Checklist · Install Warranty
- **KPIs:** response time · install vs repair mix · avg ticket · tune-up attach rate
- **Workspaces:** + Voice · Marketing · Inventory
- **Hidden:** as Locksmith

---

## ENGINE: COVERAGE / SECURITY (Phase 3)

### 11. Security Guard Company
- **Sidebar:** Sites · Guards · Shift Roster · Patrol Tours · Checkpoints · DAR Reports · Incidents · Clients · Scheduling · Payroll Export · Certifications
- **Widgets:** Coverage board (sites × shifts, gaps in red) · Guards on duty now (geo) · Open incidents · DARs pending review · Hours this pay period · Contract renewals due
- **Workflows:** roster build with license/cert checks; geo-verified clock-in at site; checkpoint scans → auto DAR; incident escalation to client; hours → payroll export → invoice reconciliation
- **AI:** DAR auto-drafted from checkpoint pings + guard notes; incident report structuring; shift-gap auto-offer to qualified available guards; monthly client summary generation
- **Automations:** shift reminder · no-show escalation (15 min) · cert expiry warnings · incident → client notification · DAR daily digest to client portal
- **Docs:** Daily Activity Report · Incident Report · Post Orders · Contract/SOW · Guard Onboarding Pack
- **KPIs:** coverage fill rate · no-show rate · incident response time · billable-vs-paid-hours margin · client retention
- **Workspaces:** + HR/People (heavy) · Training · Voice · Client Portal
- **Hidden:** Chairs/Appointments · per-job Quotes framing · Pipeline kanban (replaced by Contracts) · Boarding · Menus

### 12. Mobile Patrol
- **Sidebar:** Sites · Patrol Routes · Vehicles · Officers · Checkpoints · Hit Reports · Incidents · Alarm Response Log · Clients · Payroll Export
- **Widgets:** Live patrol map · Hits completed vs contracted tonight · Alarm responses (response time) · Incidents · Vehicle status
- **Workflows:** route of sites with N hits/night each; GPS-verified checkpoint hits; alarm-response dispatch (closest unit); per-hit client billing
- **AI:** route optimization across contracted hits; alarm-response summaries; anomaly flagging (site with rising incidents)
- **Automations:** missed-hit alert · alarm dispatch to nearest unit · client hit-report digest · contract renewal
- **Docs:** Hit Report · Alarm Response Report · Incident Report · Patrol Contract
- **KPIs:** hits per shift · alarm response time · cost per hit · vehicle utilization
- **Workspaces:** + Fleet (essential) · HR · Client Portal
- **Hidden:** as Guard Company; shift roster simplifies to route assignment

### 13. Property Management
- **Sidebar:** Properties · Units · Tenants · Leases · Maintenance Requests · Vendors · Inspections · Rent Tracking · Notices · Owners · Owner Reports
- **Widgets:** Open maintenance by urgency · Rent collected vs due · Lease expiries 90d · Vacancy list · Delinquency list · Inspection schedule
- **Workflows:** tenant portal request → AI triage (trade + urgency) → vendor/tech dispatch (reuses DISPATCH core) → completion photos → owner visibility; lease lifecycle; move-in/out inspections
- **AI:** request triage; lease renewal risk prediction; owner monthly report generation; arrears follow-up sequences
- **Automations:** rent reminder (before/on/late) · renewal offer 90d · maintenance status updates to tenant · inspection scheduling · late notice generation
- **Docs:** Lease Agreement · Notice templates (jurisdiction-aware) · Move-in/out Inspection Report · Owner Statement · Vendor Work Order
- **KPIs:** occupancy · rent collection rate · avg days-to-fill · maintenance cost per unit · renewal rate
- **Workspaces:** + Client Portal (tenant + owner variants) · Finance · Voice
- **Hidden:** Quotes pipeline · Chairs · Patrol tours · Memberships

### 14. Facility Management
- **Sidebar:** Facilities · Assets/Equipment · Work Orders · Preventive Maintenance Schedule · Vendors · Technicians · Inspections · Compliance Log · Clients
- **Widgets:** Open work orders by priority · PM tasks due this week · Asset downtime · SLA compliance · Vendor performance
- **Workflows:** preventive maintenance calendar per asset; reactive work orders with SLA timers; compliance inspections (fire, elevator) with certificates
- **AI:** PM schedule generation from asset registry; work-order triage; compliance deadline monitoring; client SLA reporting
- **Automations:** PM task generation · SLA breach escalation · certificate expiry alerts · vendor dispatch
- **Docs:** Work Order · PM Checklist · Compliance Certificate log · SLA Report · Vendor Contract
- **KPIs:** SLA hit rate · PM completion rate · asset downtime · cost per sqft
- **Workspaces:** + Fleet/Asset (essential) · Client Portal · HR
- **Hidden:** Rent/leases · Chairs · Sales pipeline framing · Memberships

---

## ENGINE: BEAUTY (APPOINTMENT core — Phase 2)

### 15. Hair Salon
- **Sidebar:** Appointments (calendar-first home) · Stylists · Chairs · Services & Pricing · Clients (formulas, preferences, photos) · Packages & Memberships · Gift Cards · Retail Inventory · Before/After Gallery · Booking Page
- **Widgets:** Today's book (by chair) · Fill rate this week · No-shows prevented · Rebook rate · Retail sales · New reviews
- **Workflows:** online booking with stylist choice; color formula history per client; checkout with tips + retail; 6-week rebook prompts; booth-renter revenue split view
- **AI:** AI answers phone/Instagram DMs and books; rebooking nudge timed to service cycle; slow-Tuesday flash-fill campaign; before/after → Instagram post
- **Automations:** confirmation + 24h reminder · no-show fee policy flow · rebook prompt at cycle · birthday offer · win-back at 2× cycle
- **Docs:** Service Menu · Gift Certificate · Color Consent Form · Booth Rental Agreement
- **KPIs:** chair utilization · rebook rate · avg ticket + retail attach · no-show rate · new vs returning
- **Workspaces:** + Marketing/Social (essential) · Voice · Inventory · Brand Studio
- **Hidden:** Dispatch/zones · Field app · Sites/patrol · Leases · Work orders · Quotes pipeline (fixed-price services)

### 16. Barbershop
- **Sidebar:** Appointments · Barbers · Chairs · Services · Clients · Walk-in Queue · Memberships (cut clubs) · Booking Page
- **Widgets:** Today's book + walk-in queue · Chair utilization · Membership MRR · Rebook rate · Reviews
- **Workflows:** hybrid walk-in queue + appointments; membership clubs (2 cuts/mo); fast checkout
- **AI:** queue-time SMS answers ("how long's the wait?"); membership lapse win-back
- **Automations:** queue position texts · reminder · rebook at 3 weeks · membership renewal
- **Docs:** Service Menu · Membership Agreement
- **KPIs:** cuts per chair-day · wait time · membership count/churn · tips
- **Workspaces:** + Marketing/Social · Voice
- **Hidden:** as Hair Salon + color formulas

### 17. Nail Salon
- **Sidebar:** Appointments · Technicians · Stations · Services · Clients (design gallery) · Packages · Retail · Booking Page
- **Widgets:** Today's book by station · Group bookings · Fill rate · Rebook rate · Reviews
- **Workflows:** multi-service duration stacking (mani+pedi parallel stations); group/party bookings; design photo gallery per client
- **AI:** DM booking from Instagram design inquiries; fill-rate campaigns
- **Automations:** reminder · rebook at 2–3 weeks · group booking coordination · win-back
- **Docs:** Service Menu · Party Booking Agreement
- **KPIs:** station utilization · avg ticket · rebook rate · group booking revenue
- **Workspaces:** + Marketing/Social (design content is the marketing) · Voice
- **Hidden:** as Hair Salon

### 18. Spa / Beauty Clinic
- **Sidebar:** Appointments · Practitioners · Rooms · Treatment Menu · Clients (intake + contraindications) · Packages & Series · Memberships · Gift Cards · Retail · Booking Page
- **Widgets:** Room utilization · Series/packages outstanding (liability) · Membership MRR · Intake forms pending · Reviews
- **Workflows:** intake + consent before first treatment; treatment series tracking (6-session packages); room+practitioner dual-constraint booking; quiet-hours scheduling
- **AI:** treatment recommendation follow-ups; series completion nudges; intake summarization for practitioner
- **Automations:** intake form on booking · reminder w/ prep instructions · series session reminders · membership billing · post-treatment care SMS
- **Docs:** Intake Form · Consent Forms per treatment · Series Agreement · Gift Certificate
- **KPIs:** room utilization · series completion rate · membership churn · retail attach · avg ticket
- **Workspaces:** + Marketing/Social · Voice · Inventory · Brand Studio
- **Hidden:** as Hair Salon + walk-in queue

---

## ENGINE: AUTOMOTIVE (Phase 2)

### 19. Auto Repair Shop
- **Sidebar:** Appointments (bays) · Work Orders · Vehicles (VIN history) · Estimates & Approvals · Digital Inspections · Parts Orders · Customers · Service Reminders
- **Widgets:** Bay board (today) · Approvals pending (money waiting) · Cars waiting on parts · Weekly revenue vs target · Comeback rate · Reviews
- **Workflows:** intake w/ photos → digital inspection with findings → estimate → SMS approval per line-item → work → QC → pickup + payment; declined-work follow-up later
- **AI:** service advisor AI explains repairs in plain language over SMS; declined-work resurrection campaigns; estimate follow-up
- **Automations:** appointment reminder · inspection report to customer · approval nudge · vehicle-ready text · service reminder by date/mileage · review request
- **Docs:** Estimate/RO · Digital Inspection Report · Invoice · Authorization Form · Warranty
- **KPIs:** avg RO value · approval rate · bay utilization · comeback rate · declined-work recapture
- **Workspaces:** + Voice · Inventory (parts) · Marketing
- **Hidden:** Chairs/stylists · Dispatch/zones · Field app · Sites · Leases · Class schedules

### 20. Auto Detailing
- **Sidebar:** Appointments (bays or mobile routes — preset flag) · Packages & Add-ons · Vehicles · Customers · Memberships (monthly detail clubs) · Before/After Gallery · Booking Page
- **Widgets:** Today's schedule · Membership MRR · Package mix · Photo gallery queue · Reviews
- **Workflows:** package-based booking with vehicle-size pricing; before/after photo sets; monthly membership clubs; mobile mode uses DISPATCH routing
- **AI:** photo-based quote (send pics of interior); membership upsell after 2nd visit; gallery → social posts
- **Automations:** reminder · photos-on-completion to customer · membership billing · seasonal campaigns (salt season, pollen season) · review request
- **Docs:** Package Menu · Membership Agreement · Condition Report (pre-existing damage)
- **KPIs:** revenue per bay/route-day · membership count · package mix · photo→booking conversion
- **Workspaces:** + Marketing/Social (before/after content) · Voice
- **Hidden:** Work orders/parts · mechanical Inspections · as Auto Repair

### 21. Tire Shop
- **Sidebar:** Appointments (bays) · Work Orders · Tire Inventory (size-indexed) · Tire Storage (seasonal hotel) · Vehicles · Customers · Quotes
- **Widgets:** Bay board · Storage capacity used · Size-availability alerts · Seasonal changeover bookings · Reviews
- **Workflows:** size lookup → quote → book; seasonal changeover surge scheduling; tire hotel check-in/out with location tags
- **AI:** size/fitment lookup assistant; changeover season campaign automation to storage customers
- **Automations:** changeover season reminders (stored-tire customers first) · storage renewal billing · low-tread follow-up · review request
- **Docs:** Quote · Invoice · Storage Agreement · Torque Check Notice
- **KPIs:** changeover throughput · storage utilization/revenue · inventory turns · avg ticket
- **Workspaces:** + Inventory (essential) · Voice · Marketing
- **Hidden:** as Auto Repair; digital inspections simplify to tread checks

---

## ENGINE: HEALTH & WELLNESS (Phase 3 light / Phase 4 regulated)

### 22. Dental Clinic  ⚠ Phase 4 — after PHI compliance workstream
- **Sidebar:** Appointments (operatories) · Patients · Treatment Plans · Recalls (hygiene) · Intake & Consent Forms · Insurance Claims prep · Providers · Booking Page
- **Widgets:** Today's schedule by operatory · Recall list due · Unscheduled treatment value · No-show risk flags · Production vs goal
- **Workflows:** new-patient intake → exam → phased treatment plan → procedure-duration scheduling; 6-month hygiene recall engine; insurance verification notes
- **AI:** recall outreach sequences; unscheduled-treatment follow-up ("your crown from March"); intake summarization — all under PHI boundaries
- **Automations:** recall due · reminder cascade (3d/1d/2h) · post-op instructions · review request (compliant wording) · reactivation at 9 months
- **Docs:** Intake Form · Medical History · Consent per procedure · Treatment Plan Presentation · Post-op Instructions
- **KPIs:** production per chair · recall compliance rate · unscheduled treatment backlog · no-show rate · new patients/mo
- **Workspaces:** + Voice (compliant mode) · Client Portal · Finance
- **Hidden:** everything field/patrol/property/case; Marketing constrained to compliant campaigns

### 23. Medical Clinic  ⚠ Phase 4 — after PHI compliance workstream
- **Sidebar:** Appointments (providers/rooms) · Patients · Intake Forms · Referrals · Visit Summaries (not an EMR replacement in v1) · Recalls · Providers · Booking Page
- **Widgets:** Today's schedule · Waitlist · Referral queue · No-show risk · Intake pending
- **Workflows:** triage-aware booking (urgent vs routine); referral intake and tracking; annual physical recalls; waitlist backfill on cancellation
- **AI:** appointment triage; waitlist auto-backfill; recall campaigns — PHI-bounded
- **Automations:** reminder cascade · intake before visit · annual recall · no-show rebook offer
- **Docs:** Intake · Consent · Referral Letter template · Sick Note template
- **KPIs:** provider utilization · no-show rate · recall compliance · new-patient wait time
- **Workspaces:** + Voice (compliant) · Client Portal
- **Hidden:** as Dental; we integrate with EMRs, not replace them, in v1

### 24. Physiotherapy Clinic  (Phase 3 — lighter compliance entry)
- **Sidebar:** Appointments · Patients · Treatment Plans (visit series) · Exercise Programs (assignable) · Intake Forms · Providers · Insurance Receipts · Booking Page
- **Widgets:** Today's schedule · Plans mid-course (drop-off risk) · Discharge-ready list · No-shows · New referrals
- **Workflows:** assessment → plan of N visits → progress tracking → discharge; home exercise assignment; insurance-receipt issuance
- **AI:** drop-off prediction mid-plan (quitting at visit 4 of 10 is the #1 revenue leak); exercise-adherence nudges
- **Automations:** visit-series reminders · missed-visit rebook · home exercise nudges · reactivation 3mo post-discharge
- **Docs:** Intake/Consent · Treatment Plan · Progress Note summary · Insurance Receipt · Home Exercise Sheet
- **KPIs:** plan completion rate · visits per plan · provider utilization · referral sources
- **Workspaces:** + Voice · Client Portal
- **Hidden:** as Dental minus operatory framing

### 25. Chiropractic Clinic  (Phase 3)
- Same skeleton as Physiotherapy with: **Sidebar** swaps Exercise Programs for Care Plans (visit packages) + adds Memberships (monthly adjustment plans). **AI:** package renewal timing; lapsed-patient reactivation. **KPIs:** weekly visit capacity, package renewal rate, patient lifetime visits. **Hidden:** as Physio.

### 26. Veterinary Clinic  (Phase 2–3 — no human-PHI regime)
- **Sidebar:** Appointments (vets/rooms) · Patients (pets) + Owners · Vaccine Records & Due Dates · Reminders · Treatment Notes · Boarding (optional flag) · Providers · Booking Page
- **Widgets:** Today's schedule · Vaccines due this month · New patient count · No-shows · Reviews
- **Workflows:** pet+owner dual records; vaccine schedule engine; annual wellness recalls; new-puppy/kitten onboarding series
- **AI:** vaccine-due campaigns; post-visit care instructions; owner triage ("is this urgent?" → book or ER referral)
- **Automations:** vaccine due · annual wellness recall · reminder cascade · post-visit care SMS · review request
- **Docs:** Vaccine Certificate · Intake · Surgery Consent · Health Certificate · Invoice
- **KPIs:** vaccine compliance · wellness plan attach · avg transaction · new clients/mo
- **Workspaces:** + Voice · Client Portal · Inventory (meds/retail)
- **Hidden:** human-clinic framing; field/patrol/property/case stacks

---

## ENGINE: PET SERVICES (Phase 2)

### 27. Pet Grooming
- **Sidebar:** Appointments · Groomers · Stations/Tubs · Pets (breed, coat, temperament, vaccine gate) · Owners · Report Cards · Packages · Booking Page
- **Widgets:** Today's book · Vaccine-expired flags · Rebook rate by coat cycle · Report cards pending · Reviews
- **Workflows:** vaccine verification gate on booking; breed/coat-based duration & pricing; photo report card per groom; recurring rebook by coat cycle (4/6/8 weeks)
- **AI:** report card auto-draft from groomer notes + photos; rebooking timed per breed; DM booking
- **Automations:** vaccine expiry block + owner nudge · reminder · report card send · rebook prompt at cycle · no-show fee flow
- **Docs:** Grooming Consent · Matted Coat Waiver · Report Card · Package Agreement
- **KPIs:** groomer utilization · rebook rate · avg ticket · no-show rate
- **Workspaces:** + Marketing/Social (pet photos = best content on the internet) · Voice
- **Hidden:** field/dispatch · patrol · property · case · work orders

### 28. Dog Walking  (DISPATCH core — mobile)
- **Sidebar:** Walk Schedule (recurring) · Walkers · Routes · Pets & Owners · Visit Reports (GPS + photo) · Keys/Access · Packages
- **Widgets:** Today's walks map · Recurring MRR · Missed/late walks · Walker capacity · New client trials
- **Workflows:** recurring walk slots; GPS-tracked visits with photo report; key management; walker substitution
- **AI:** route packing optimization; visit report auto-draft; trial→recurring conversion follow-up
- **Automations:** walk-complete report to owner · schedule change notices · package renewal · walker substitution alerts
- **Docs:** Service Agreement · Key Release · Vet Release · Visit Report
- **KPIs:** walks per walker-day · recurring churn · trial conversion · on-time rate
- **Workspaces:** + Client Portal · Marketing
- **Hidden:** bays/chairs · patrol · per-job invoicing (package billing instead)

### 29. Pet Boarding  (reservation/capacity variant)
- **Sidebar:** Reservations Calendar (capacity by run/suite type) · Pets & Owners · Check-in/out · Feeding & Med Schedules · Report Cards · Vaccine Gate · Add-on Services (bath, walk)
- **Widgets:** Occupancy this week · Arrivals/departures today · Meds due · Vaccine flags · Holiday booking pace
- **Workflows:** capacity reservation with suite types; check-in with belongings/instructions; daily care checklists; holiday surge waitlists
- **AI:** daily photo update drafting; holiday early-bird campaigns; care-instruction summarization for staff
- **Automations:** confirmation + prep list · vaccine gate · daily update to owner · post-stay review + rebook
- **Docs:** Boarding Agreement · Vet Release · Care Instructions Sheet · Report Card
- **KPIs:** occupancy rate · avg daily rate · add-on attach · repeat rate
- **Workspaces:** + Voice · Marketing · Client Portal
- **Hidden:** dispatch/routes · bays · patrol · case

---

## ENGINE: FITNESS (Phase 2)

### 30. Gym
- **Sidebar:** Members · Memberships & Billing · Class Schedule · Check-ins · Trainers · PT Sessions · Trials/Leads Pipeline · Booking Page
- **Widgets:** Active members + MRR · Check-in trend (churn signal) · Trials in pipeline · Class fill rates · Failed payments · Reviews
- **Workflows:** trial → tour → membership with recurring billing; class capacity booking; attendance-decay churn watch; failed-payment recovery
- **AI:** churn prediction from check-in decay → win-back before cancel; trial follow-up sequences; class-fill campaigns
- **Automations:** trial follow-up D1/D3/D7 · failed payment retry + dunning · absent-14-days win-back · class reminder · membership renewal
- **Docs:** Membership Agreement · Waiver · PT Package Agreement · Freeze/Cancel forms
- **KPIs:** MRR · churn rate · trial conversion · check-ins per member · PT attach rate
- **Workspaces:** + Marketing/Social · Finance (recurring billing heavy) · Voice
- **Hidden:** dispatch · chairs · patrol · property · work orders · matters

### 31. Yoga Studio
- **Sidebar:** Class Schedule · Instructors · Class Packs & Memberships · Students · Check-ins · Workshops/Events · Booking Page
- **Widgets:** Today's classes + fill · Pack expiries · Intro-offer conversions · Workshop sales · Reviews
- **Workflows:** intro-offer funnel (2 weeks unlimited → membership); class packs with expiry; workshop ticketing; waitlists
- **AI:** intro-offer conversion sequences; lapsed-student win-back; instructor-sub notifications
- **Automations:** class reminder · waitlist promotion · pack expiry warning · intro-offer nurture · win-back
- **Docs:** Waiver · Membership Agreement · Workshop Ticket
- **KPIs:** intro conversion rate · class fill rate · pack breakage · membership churn
- **Workspaces:** + Marketing/Social · Voice
- **Hidden:** as Gym; PT sessions optional

### 32. Personal Trainer
- **Sidebar:** Sessions Calendar · Clients · Session Packs · Workout Plans · Progress Tracking (measurements/PRs) · Booking Page
- **Widgets:** Sessions this week · Pack balances (sessions remaining) · Client progress highlights · Renewals due · Leads
- **Workflows:** consult → pack purchase → recurring session slots → progress check-ins → renewal at 2 sessions remaining
- **AI:** renewal timing nudges; progress summaries for client check-ins; no-show/late-cancel handling
- **Automations:** session reminder · pack-low renewal prompt · monthly progress check-in · lead follow-up
- **Docs:** PAR-Q/Waiver · Pack Agreement · Workout Plan sheet
- **KPIs:** sessions/week · pack renewal rate · client retention months · revenue per client
- **Workspaces:** + Marketing/Social (transformation content) · Client Portal
- **Hidden:** class schedule · check-in hardware · everything ops-heavy

---

## ENGINE: HOSPITALITY (thin slice — universal workspaces + light booking)

### 33. Restaurant
- **Sidebar:** Reservations (thin) · Waitlist · Events/Private Dining Pipeline · Guests · Reviews · Marketing · Communication
- **Widgets:** Tonight's reservations · Review score trend + unanswered reviews · Social post calendar · Private-dining pipeline value
- **Workflows:** reservation/waitlist via booking page + AI phone; private-event inquiries → proposal (CASE-lite); review reply operations; event promotion
- **AI:** phone AI takes reservations + answers "are you open / do you have a patio" (deflects most calls); review reply generator; social posts from menu/specials photos
- **Automations:** reservation confirmation/reminder · no-show follow-up · post-visit review request · weekly special campaigns
- **Docs:** Private Event Proposal/BEO · Catering Agreement
- **KPIs:** covers via Sofilic · review score · reply rate · event pipeline revenue
- **Workspaces:** Reviews (essential) · Marketing/Social (essential) · Voice (essential) · Communication
- **Hidden:** POS/orders/kitchen (never build) · dispatch · resource appointments · all ops engines

### 34. Cafe
- Same thin slice as Restaurant minus reservations. **Sidebar:** Catering/Wholesale Inquiries Pipeline · Guests/Regulars · Reviews · Marketing · Communication. AI phone answers hours/menu; social from product photos; catering pipeline is the revenue add. **KPIs:** review score · catering revenue · campaign redemptions.

### 35. Bakery
- As Cafe, plus **Custom Order Pipeline** (cakes: inquiry → design/quote → deposit → pickup date) — maps directly onto the existing Lead pipeline with deposits via existing payments. **Docs:** Custom Order Form · Deposit Invoice. **Automations:** pickup reminder · deposit request · seasonal pre-order campaigns. **AI:** custom-cake inquiry qualification (size/date/design/photo). **KPIs:** custom order revenue · deposit conversion · pickup no-shows.

### 36. Food Truck
- **Sidebar:** Schedule & Locations (public calendar) · Event Bookings Pipeline · Catering Quotes · Followers/Guests · Reviews · Marketing
- **Widgets:** This week's locations · Event pipeline · Social reach · Reviews
- **Workflows:** location calendar published to booking page + auto social posts ("we're at X today"); private event/catering pipeline with quotes + deposits
- **AI:** location announcement posts; event inquiry qualification
- **Automations:** daily location post · event follow-up · deposit request
- **KPIs:** event revenue · social engagement · repeat event clients
- **Hidden:** everything ops-heavy; lightest preset in the catalog

---

## ENGINE: CASE / PROFESSIONAL SERVICES (Phase 3)

### 37. Law Firm
- **Sidebar:** Matters · Intake Pipeline (with conflict-check stage) · Clients · Time Entries · Retainers · Milestones/Deadlines · Documents (heavy) · Client Portal · Tasks
- **Widgets:** Deadlines next 14d (malpractice guard) · Unbilled time · Retainer balances low · Intake pipeline · Matters by stage
- **Workflows:** inquiry → conflict check → engagement letter e-sign → matter opens with practice-area template → time capture → retainer replenishment → closing letter
- **AI:** intake qualification (practice area, urgency, jurisdiction); document first-drafts from templates; matter status summaries for clients (kills the "any update?" call, the #1 client complaint)
- **Automations:** engagement letter follow-up · retainer low-balance replenishment · deadline reminder cascade · client status cadence · review request at close (where bar rules permit)
- **Docs:** Engagement Letter · Retainer Agreement · practice-area matter templates · Closing Letter
- **KPIs:** realization rate · retainer coverage · intake conversion · matter cycle time
- **Workspaces:** + Client Portal (essential) · Finance · Knowledge (precedents)
- **Hidden:** dispatch · chairs · patrol · inventory · class schedules · all field framing

### 38. Accounting Firm
- **Sidebar:** Engagements · Clients · Deadline Calendar (tax/filing) · Document Requests (client upload portal) · Time Entries · Recurring Engagements (monthly bookkeeping) · Tasks
- **Widgets:** Filing deadlines 30d · Docs outstanding by client (the bottleneck) · Recurring MRR · WIP/unbilled · E-sign pending
- **Workflows:** engagement letter → document checklist → chase missing docs → prepare → review → file → invoice; recurring monthly close checklists
- **AI:** document-chase sequences (polite, escalating — saves hours weekly); deadline monitoring; engagement status summaries
- **Automations:** doc request reminders · deadline countdown · recurring engagement task generation · invoice on filing
- **Docs:** Engagement Letter · Document Checklist per return type · Filing Confirmation
- **KPIs:** on-time filing rate · doc turnaround · realization · recurring vs seasonal mix
- **Workspaces:** + Client Portal (doc upload essential) · Finance · Knowledge
- **Hidden:** as Law Firm

### 39. Marketing Agency
- **Sidebar:** Engagements/Retainers · Proposals Pipeline · Clients · Deliverables Board · Time Entries · Client Approvals · Client Portal · Tasks
- **Widgets:** Retainer utilization by client · Deliverables due · Proposals outstanding · Unbilled overage · Client health flags
- **Workflows:** proposal → SOW e-sign → retainer engagement → monthly deliverables → client approval loops → utilization-based renewal/upsell
- **AI:** proposal drafting from discovery notes; monthly client report generation; scope-creep detection (hours vs retainer)
- **Automations:** approval nudges · retainer renewal 30d · monthly report send · overage alerts
- **Docs:** Proposal · SOW · Monthly Report · Change Order
- **KPIs:** retainer utilization · client churn · proposal win rate · revenue per client
- **Workspaces:** + Client Portal · Marketing (dogfooding) · Knowledge
- **Hidden:** as Law Firm

### 40. Consulting Firm
- Same skeleton as Marketing Agency with milestones/phases replacing the deliverables board. **Docs:** Proposal · MSA/SOW · Phase Report. **AI:** engagement summaries + phase-gate reports. **KPIs:** utilization · effective rate · pipeline coverage.

### 41. Real Estate Agency
- **Sidebar:** Listings Pipeline (Lead→Showing→Offer→Conditional→Closed) · Buyers & Sellers · Showings Calendar · Offers/Deals · Transaction Checklists (conditions, deadlines) · Open Houses · Client Portal
- **Widgets:** Active listings + days-on-market · Deals in condition period (deadline flags) · Showings this week · Pipeline GCI forecast · Reviews
- **Workflows:** listing intake → marketing kit (photos → posts) → showings with feedback capture → offers → condition deadline tracking → close → past-client nurture (the referral engine)
- **AI:** listing description generation; showing feedback collection by SMS; past-client anniversary/market-update campaigns; open-house lead qualification
- **Automations:** showing confirmations + feedback request · condition deadline alerts · closing review request · annual home-anniversary touch · new-listing social posts
- **Docs:** Listing Agreement · Offer Summary · Condition Checklist · Buyer Rep Agreement
- **KPIs:** GCI pipeline · listing days-on-market · showings-to-offer ratio · past-client referral rate
- **Workspaces:** + Marketing/Social (essential) · Voice · Client Portal
- **Hidden:** retainers/time entries · dispatch · chairs · patrol

### 42. Home Care  (COVERAGE + CASE hybrid — Phase 3/4)
- **Sidebar:** Clients (care plans) · Caregivers · Visit Schedule (recurring) · Visit Verification (geo clock-in) · Care Notes · Family Portal · Certifications · Payroll Export
- **Widgets:** Today's visit coverage (gaps red) · Missed check-ins (safety) · Care notes pending · Cert expiries · Family messages
- **Workflows:** assessment → care plan → recurring caregiver-matched visits → geo-verified check-in/out → visit notes → family visibility → payroll/invoice from verified hours
- **AI:** caregiver-client matching; visit-note summarization for families; urgent gap backfill
- **Automations:** visit reminders to caregiver · missed check-in escalation (safety-critical) · family daily digest · cert expiry
- **Docs:** Care Plan · Service Agreement · Visit Note · Incident Report
- **KPIs:** visit fill rate · missed-visit rate · caregiver retention · billed vs paid hours
- **Compliance note:** PHI-adjacent — align with the healthcare workstream before full launch.
- **Hidden:** sales pipeline framing · bays/chairs · patrol tours (visit verification instead)

### Bonus presets (same patterns, near-zero cost)
- **Child Care** (APPOINTMENT/roster variant): Enrollment Pipeline + Waitlist · Children & Families · Rooms/Ratios · Attendance with authorized-pickup check · Daily Report Cards · Recurring Tuition Billing · Family Portal. Hidden: everything field/patrol/case/auto.
- **Photography Studio** (APPOINTMENT + CASE-lite): Session Bookings · Packages · Shoot Pipeline (Inquiry→Booked→Shot→Editing→Delivered) · Galleries · Contracts & Deposits · Mini-Session Events. Hidden: dispatch · patrol · property · work orders.

---

# PART 3 — UNIVERSAL WORKSPACES

Tiering: **Core** = in every tenant, every plan. **Add-on** = toggle per preset, priced. **Marketplace** = installed on demand, priced. Every workspace below states MVP vs Advanced so scope is unambiguous.

| # | Workspace | Tier | Replaces / reduces | Pricing potential |
|---|---|---|---|---|
| 1 | Marketing | Add-on | Mailchimp, Constant Contact | $49–99/mo |
| 2 | Social Media | Add-on (bundled w/ Marketing) | Buffer, Hootsuite, Later | in Marketing bundle |
| 3 | Brand Studio | Marketplace | Canva (partially) | $19–29/mo |
| 4 | Communication | **Core** | separate texting apps, shared inboxes | drives plan value |
| 5 | Voice | Add-on | answering services ($300–800/mo), missed revenue | $99–199/mo + usage |
| 6 | Reviews / Reputation | **Core (basic)** / Add-on (pro) | Podium, Birdeye ($300–500/mo) | $49–99/mo pro tier |
| 7 | Documents | **Core** | PandaDoc-lite, printed forms | drives plan value |
| 8 | Knowledge / Company Brain | Add-on | Notion wikis, tribal knowledge | $29–49/mo |
| 9 | Media Library | — folded into Documents + job/gallery records | Google Drive (not worth replacing) | none (see kill note) |
| 10 | Finance | **Core (basic)** | invoicing tools; QuickBooks stays via integration | drives plan value |
| 11 | HR / People | Add-on | BambooHR-lite, spreadsheets | $49–99/mo |
| 12 | Training | Marketplace | Trainual ($99+/mo) | $49/mo |
| 13 | Inventory | Add-on | spreadsheets, Sortly | $29–49/mo |
| 14 | Fleet / Asset | Add-on | Fleetio-lite | $29–49/mo |
| 15 | Website / Landing Pages | Add-on | Wix/Squarespace for service SMBs | $29–49/mo |
| 16 | Customer Portal | **Core** | client email chaos | drives plan value |
| 17 | Automation | **Core** | Zapier for internal flows | drives plan value |
| 18 | AI Workforce | **Core (1 employee)** / per-employee add-on | answering service, VA hours, collections agency | $29–79 per AI employee/mo |
| 19 | Analytics | **Core** | spreadsheet reporting | drives plan value; Executive Briefing gated to higher tiers |
| 20 | Marketplace | **Core (surface)** | n/a — it's the distribution channel | takes % of add-on revenue |

**Details (MVP → Advanced, AI advantage, integration points):**

1. **Marketing** — MVP: email/SMS campaigns to CRM segments, campaign calendar. Advanced: multi-step nurture journeys, A/B, attribution to value ledger ("this campaign made $X"). *AI:* campaign generation from operational events. *Integrates:* CRM segments, Automations triggers, Analytics attribution. *Industries:* all; essential for beauty, fitness, real estate, hospitality.
2. **Social Media** — MVP: connect Google Business Profile + Facebook + Instagram; compose, schedule, AI post generator; post-from-event (job completed → before/after post draft). Advanced: TikTok/LinkedIn, content calendar automation, engagement inbox. *AI advantage:* posts generated from real business data — structurally impossible for Buffer. *Integrates:* Media on jobs, Reviews (share 5-star reviews as posts), Brand Studio.
3. **Brand Studio** — MVP: logo, colors, fonts stored; applied to documents, portal, booking page, post templates. Advanced: AI poster/flyer generator on brand. *Integrates:* Documents, Social, Website.
4. **Communication** — MVP (Phase 1): unified inbox over existing voice/SMS/chat/email threads, assignment, internal notes. Advanced: WhatsApp, snippets, SLA timers. *AI:* draft replies, conversation summaries, sentiment flags. *Integrates:* everything — it's the connective tissue. *Explicitly excluded:* internal team chat (Slack exists).
5. **Voice** — MVP: AI receptionist (existing Vapi integration) with booking skills per engine, call logs + transcripts + missed-call text-back. Advanced: call routing trees, campaigns/outbound reminders by voice, multilingual. *AI:* this IS the AI. *Integrates:* Appointments/Dispatch booking, CRM, Automations. *Pricing note:* usage-based minutes on top of flat fee protects margin.
6. **Reviews / Reputation** — MVP (Phase 1): Google + Facebook ingestion, AI reply drafts, review request automation (exists), reputation score, review widget for website. Advanced: competitor benchmarking, review-gating compliance flows, multi-location rollups. *AI:* reply generation in brand voice; theme extraction ("customers keep mentioning parking"). *Integrates:* job completion triggers, Social (share good reviews), Analytics.
7. **Documents** — MVP: existing templates + e-sign + per-preset template packs. Advanced: conditional templates, bulk generation, version history. *AI:* draft from context (matter/job/patient). *Integrates:* pipeline stages, portal, payments (doc → pay link).
8. **Knowledge / Company Brain** — MVP: repackage the existing pgvector RAG — upload SOPs/manuals, staff + AI employees answer from them. Advanced: auto-suggested articles from resolved conversations, per-role visibility. *AI:* it is the retrieval layer every other AI feature quietly uses — packaging it as a workspace monetizes infrastructure we already run. *Integrates:* Field copilot, AI receptionist, Training.
9. **Media Library** — **not built as a standalone workspace** (fails the product rule). Photos/videos live on jobs, report cards, galleries, and Social. A simple "all media" browse view over those records ships free inside Documents. This is the one requested workspace we push back on.
10. **Finance** — MVP: existing invoices/payments/value ledger + expense capture + payout views. Advanced: P&L-lite, payroll export packs (coverage engines), QuickBooks/Xero sync (integration, not replacement). *AI:* collections AI (exists), cash-flow forecast (exists in briefing). *Integrates:* every revenue event already lands here via the value ledger.
11. **HR / People** — MVP: staff records, roles, certifications/licenses with expiry (coverage engines need this at MVP), time-off. Advanced: onboarding checklists, performance notes, payroll export. *AI:* cert-expiry monitoring, shift-gap matching. *Integrates:* Scheduling, Field app, Training, Payroll export.
12. **Training** — MVP: courses from Knowledge articles + completion tracking. Advanced: quizzes, role-based paths, compliance training records (security guards, home care). *AI:* course generation from SOPs. *Integrates:* Knowledge, HR certifications.
13. **Inventory** — MVP: parts/products list, stock counts, job/service consumption. Advanced: reorder points, supplier POs, barcode. *AI:* restock prediction from job pipeline. *Industries:* auto, tire (essential), HVAC/plumbing parts, salon/spa retail, vet meds.
14. **Fleet / Asset** — MVP: vehicles/assets, assignment, maintenance reminders, mileage from field app travel logs (already captured!). Advanced: inspection checklists, cost per vehicle. *Industries:* field services, mobile patrol (essential), facility (asset variant).
15. **Website / Landing Pages** — MVP: one-page business site generated from preset + brand kit + booking page + review widget, on subdomain or custom domain. Advanced: multi-page, SEO tooling, campaign landing pages. *AI:* copy generated from business profile. *Integrates:* Booking, Reviews, Brand, lead forms → CRM. *This closes the loop: a business can run entirely on Sofilic with zero other software.*
16. **Customer Portal** — Core; exists. Per-engine variants (tenant portal, client portal, family portal, site portal) are preset configurations of the same portal system.
17. **Automation** — Core; exists (rules + runs + presets per industry).
18. **AI Workforce** — Core surface; exists. Per-employee pricing is the expansion lever (see Part 4).
19. **Analytics** — Core; exists (value-ledger KPIs). Executive Briefing (exists) gates to Business tier+.
20. **Marketplace** — Core surface; exists. First-party only until platform scale (per strategy doc).

---

# PART 4 — PRICING STRATEGY

Anchor: replace 3–7 subscriptions totaling $400–1,200/mo. Price at 40–60% of the replaced stack. Per-location pricing; seats generous (seat-gating punishes exactly the businesses we want growing).

| Tier | Price/mo (location) | Includes | Fits |
|---|---|---|---|
| **Starter** | $79 | Core (Dashboard, CRM, Calendar, Tasks, Inbox, Documents, Invoicing/Payments, Automations-basic, Analytics-basic, Portal, Reviews-basic, Marketplace) + engine modules for your industry + 1 AI employee + 3 staff users | Solo operators: PT, locksmith, food truck, detailer, dog walker |
| **Growth** | $149 | Starter + Voice AI receptionist (300 min) + Reviews Pro + Marketing/Social + 10 users + 3 AI employees | 2–10 person: salons, barbershops, cleaning, groomers, small trades |
| **Business** | $299 | Growth + Executive Briefing + full AI workforce (8) + Inventory + Fleet/Asset + HR basic + Website + 25 users + Voice 1,000 min | 10–30 person: HVAC/plumbing cos, gyms, auto shops, clinics (non-PHI), agencies |
| **Pro** | $499 | Business + engine-depth packs (Coverage/Property/Case full) + Training + HR full + Client Portal variants + API access + 50 users | Guard companies, property managers, law/accounting firms, multi-crew trades |
| **Enterprise** | $999+ custom | Pro + multi-location/company + compliance pack (healthcare when live) + SSO + custom module + dedicated CSM + SLA | Franchises, multi-location, dental/medical groups |

**Add-on pricing (any tier):**
- **Voice minutes:** included allotment, then ~$0.15–0.25/min. The answering-service comparison ($1+/min human) makes this an easy sell.
- **Extra AI employees:** $29–79/mo each by authority level (approval-mode cheaper than autonomous). Leaderboard ROI makes upsell self-serve: "Collections AI recovered $840 for tenants like you."
- **Marketing Pro** (journeys, attribution): +$49/mo. **Reviews Pro** standalone: +$49/mo (Podium at $300+ is the foil).
- **Website custom domain + pages:** +$29/mo. **Knowledge/Brain:** +$29/mo. **Training:** +$49/mo.
- **Marketplace:** first-party packs (template packs $19–49 one-time, AI employees as above); 20–30% rev-share reserved for future third parties.

**Industry fit note:** hospitality gets a special **"Sofilic Marketing" $99/mo** SKU (Reviews Pro + Social + Voice-lite + thin reservations) — full ops tiers are irrelevant there and a cheap SKU converts the segment.

---

# PART 5 — UI/UX STRUCTURE

One shell, ten fixed groups, never more. Presets populate groups; empty groups don't render. Target: **max 7 visible top-level items + "More"**; inside a group, max ~6 items. Current premium shell (Sofilic OS sidebar, OS topbar, mobile drawer) is kept — groups become collapsible sections in it.

**Fixed group skeleton:**
1. **Dashboard** (always single item)
2. **Operations** ← engine modules live here (the only group that changes dramatically)
3. **Customers** (CRM, segments, portal admin; renamed per preset: Patients/Members/Tenants/Guests/Clients)
4. **Marketing** (campaigns, social, reviews, brand, website)
5. **Communication** (inbox, voice, phone logs)
6. **Finance** (invoices, payments, plans/memberships billing, payroll export where relevant)
7. **People** (staff, schedule/roster, HR, training, certifications) — only when team size > 1
8. **AI** (AI workforce, executive briefing, knowledge brain)
9. **Analytics** (dashboards, reports)
10. **More** (marketplace, integrations, API) + **Settings** pinned bottom

**Examples of the Operations group per industry (everything else stays uniform):**
- *HVAC:* Pipeline · Jobs · Dispatch · Schedule · Quotes · Maintenance Plans · Equipment
- *Hair Salon:* Appointments · Services · Stylists & Chairs · Gift Cards · Retail
- *Guard Company:* Sites · Roster · Patrol Tours · DARs · Incidents · Payroll Export
- *Property Mgmt:* Properties · Units · Tenants · Leases · Maintenance · Vendors · Inspections
- *Law Firm:* Matters · Intake · Time · Retainers · Deadlines
- *Gym:* Members · Memberships · Classes · Check-ins · Trials
- *Restaurant:* Reservations · Waitlist · Events Pipeline
- *Auto Repair:* Bays · Work Orders · Estimates · Inspections · Vehicles · Parts

**Rules:** Dashboard widgets defined by preset (each widget maps to an existing API); "Customers" label is vocabulary-swapped, never duplicated; hidden modules are unmounted (not greyed); mobile drawer mirrors groups; search (⌘K) spans everything as escape hatch; a "Simple mode" flag for solo operators collapses Finance+Analytics into Dashboard cards.

---

# PART 6 — EXISTING SYSTEM MAPPING

Every current module classified. **Nothing is deleted.**

| Existing (route/module) | Classification | Action |
|---|---|---|
| Dashboard (command center) | **Keep as Core** | Widgets become preset-driven; hero stays |
| Pipeline / leads board | **Keep as Core**, industry-labeled | Already config-driven — extend labels per preset |
| CRM / Contacts | **Keep as Core** | Rename per preset (Customers/Patients/Members/Tenants) |
| Dispatch board (`/dispatch`) | **Move into DISPATCH engine** | Hide for non-dispatch presets |
| Field Team app (`/jobs`, field/time, movement, copilot) | **Move into DISPATCH engine** (reused by COVERAGE later) | Hide for appointment presets |
| Scheduling (working hours, slots, calendar, book) | **Keep as Core**, becomes APPOINTMENT engine's foundation | Improve: add bookable resources, recurrence (Phase 2) |
| Quotes / Invoices / Payments / value ledger | **Keep as Core** (Finance workspace) | Untouched |
| Customer Portal | **Keep as Core workspace** | Improve: per-engine portal variants via preset |
| AI Workforce (`/workforce`, employees, leaderboard) | **Keep as Core workspace** | Per-employee pricing added at billing layer only |
| Executive Briefing (`/executive`) | **Keep**, gate to Business tier | Move under AI group |
| Analytics (`/analytics`) | **Keep as Core workspace** | Preset KPI packs added |
| Automations (`/automations`) + presets | **Keep as Core workspace** | Extend preset library per industry |
| Workflows runs (`/workflows`) | **Keep**, merge under Automations group in nav | Rename tab "Runs" |
| Marketplace (`/marketplace`) | **Keep as Core surface** | First-party focus |
| Notifications | **Keep as Core** | Untouched |
| Billing (`/billing`, plans) | **Keep as Core** | New tier/add-on structure at config level |
| Settings | **Keep as Core** | Add industry/preset panel |
| Omnichannel messaging (API: threads/voice/SMS/chat/email) | **Move into Communication workspace** | Improve: unified inbox UI (Phase 1) |
| Review request automation (exists in presets) | **Move into Reviews workspace** | Improve: ingestion + AI replies (Phase 1) |
| Business Brain RAG (pgvector, seed-brain) | **Move into Knowledge workspace** | Rename "Company Brain"; surface UI |
| Vapi voice integration | **Move into Voice workspace** | Improve: per-engine booking skills |
| `IndustryModuleConfig` (packages/config) | **Keep — becomes the Preset system** | Extend schema: `engine`, `modules[]`, `workspaces[]`, `dashboardWidgets[]`, `hiddenModules[]` |
| Tenant onboarding (`POST /tenants`) | **Keep** | Improve: country, industry (42), business size, team size fields |
| RBAC / tenant isolation / audit / compliance export | **Keep as Core** | Foundation for healthcare workstream later |
| Public API / API keys / scopes | **Keep**, gate to Pro tier | Untouched |
| Marketing site (aiow → Sofilic pages) | **Keep** | Improve: industry landing pages generated from presets |
| Old AIOW naming (env vars, localStorage keys) | **Keep internally** | Cosmetic rename only if ever convenient; never a migration project |

**Renames (labels only, zero schema changes):** Leads→per-preset vocabulary (exists) · Jobs→Work Orders/Visits/Sessions per preset · "My Jobs (Staff)"→Field Team · Portal→per-engine portal name.

---

# PART 7 — IMPLEMENTATION ROADMAP

### Phase 1 — "42 doors, one house" (Weeks 1–8) · Complexity: LOW · Risk: LOW
**Build:** extend preset schema (`engine`, `modules`, `workspaces`, `widgets`, `hidden`); 14 field-service presets + thin presets for hospitality/photography/bakery-style pipelines (they run on existing Lead pipeline today); new signup (name, country, industry, business size, team size); sidebar/module filtering from preset; preset-driven dashboard widgets; **Reviews workspace v1** (Google/FB ingestion, AI replies, requests, score); **Unified Inbox v1** over existing threads; basic Marketing/Social (GBP + FB/IG posting, AI post generator); industry landing pages on the marketing site.
**Why:** every dollar of this leverages code that already runs in production. **Customer value:** product feels purpose-built at signup; Podium replacement alone justifies Growth tier. **Revenue:** 14+ sellable verticals, Growth tier ($149) becomes defensible. **Risk:** preset sprawl — mitigate with a preset test harness (validate every preset resolves modules/widgets/labels).

### Phase 2 — "The appointment economy" (Months 3–6) · Complexity: MEDIUM · Risk: MEDIUM
**Build:** APPOINTMENT engine (bookable resources, public booking page, recurring appointments, class/group capacity, waitlist, no-show flows, checkout w/ tips & packages & memberships-billing); presets: salon, barber, nails, spa, auto repair, detailing, tire, grooming, boarding, dog walking, gym, yoga, PT, vet; **Voice workspace** (AI receptionist per-engine booking skills, minutes billing); **Marketing Studio** (campaign calendar, brand kit, event-driven post automation).
**Why:** one engine unlocks ~20 industries; Voice is the moat feature incumbents can't match. **Customer value:** front desk replaced 24/7. **Revenue:** largest TAM expansion; Voice add-on margin. **Risk:** calendar correctness (double-booking) — reuse existing conflict-free slot search as the foundation; recurring billing edge cases — Stripe subscriptions already integrated for plans.

### Phase 3 — "Serious operations" (Months 6–12) · Complexity: MEDIUM-HIGH · Risk: MEDIUM
**Build:** COVERAGE engine (sites, rosters, geo check-in, checkpoints, DAR/incident reports, payroll export) → guard, patrol, facility presets; Property preset (COVERAGE+DISPATCH composite: units, leases, tenants, rent tracking); CASE depth (matters, time, retainers, deadlines, doc-request portal) → law, accounting, agency, consulting, real estate presets; **Knowledge/Company Brain UI**; **Training workspace**; **HR/People + Fleet add-ons**; physio/chiro/vet-class wellness presets.
**Why:** high-contract-value sticky verticals; HR/Training/Fleet raise ARPU. **Customer value:** replaces Silvertrac/AppFolio-lite/Clio-lite class tools. **Revenue:** Pro tier ($499) becomes real. **Risk:** scope depth per vertical — ship one flagship customer per engine before general release.

### Phase 4 — "Regulated + platform" (Year 2) · Complexity: HIGH · Risk: HIGH (managed)
**Build:** healthcare compliance workstream (BAA, PHI data handling, audit hardening, consent) → dental/medical/home-care presets; advanced AI Business Intelligence (cross-module forecasting, benchmark data across anonymized tenants — a data moat no point-solution has); marketplace expansion (rev-share, possible third-party); Website workspace advanced; multi-location/franchise.
**Why:** highest willingness-to-pay unlocked safely; benchmarking turns scale into product. **Customer value:** "how do I compare to other HVAC companies my size" — only Sofilic can answer. **Revenue:** Enterprise tier + healthcare premiums. **Risk:** compliance cost and timeline — gated go/no-go after Phase 3 revenue proves the base.

---

## Approval checklist (what saying "approved" green-lights)
1. Preset schema extension in `packages/config` (additive, backward-compatible with the 3 existing modules).
2. Signup flow change (5 fields) + industry picker with all Phase 1 presets.
3. Sidebar/dashboard filtering driven by preset.
4. Reviews workspace v1 + Unified Inbox v1 + Social v1 as the first universal workspaces.
5. The 14 field-service presets as the first catalog wave.
6. Pricing restructure to the 5-tier + add-on model (marketing site update).

*End of blueprint.*
