# SOFILIC — Project Status & Constitution
*Read this file first in any new session, on any device. It is the single source of truth for where this project stands and the rules that govern it.*

Last updated: 2026-07-11

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

What's real (wired to live backend) vs. honest-empty (structurally complete UI, no backend yet):

| Module | Status |
|---|---|
| CRM | ✅ Real (Companies, Tasks, Contacts-from-pipeline) |
| Sales | ✅ Real (pipeline board, follow-ups) |
| Automation | ✅ Real (Recipes + Workflows + History, live toggle) |
| Payments | ✅ Real (Invoices, Estimates, Transactions, Subscriptions) |
| Apps | ✅ Real (Field Operations jobs, Marketplace) |
| Voice AI | 🟡 Agents tab real; rest honest setup states (no backend yet) |
| Conversations, Marketing, Social, Websites, SEO | 🟡 Honest empty/setup states (no backend yet) |
| Settings | ✅ Real (business type, invite-user modal) |

**Phase 2 — Dashboard real data wiring: ⏸ NOT STARTED. Awaiting explicit approval before starting.**

Do not begin Phase 2 or any new phase without the user explicitly saying so in a fresh session — this file being read is not itself approval.

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
