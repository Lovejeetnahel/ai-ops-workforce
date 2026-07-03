# Industry Module System

The mechanism that lets **one** codebase be three products. Source:
[packages/config](../packages/config/src).

## How it works

1. A tenant has exactly one `industryModule` (`FIELD_SERVICES` |
   `PROPERTY_MANAGEMENT` | `SERVICE_AGENCIES`).
2. That key resolves to an `IndustryModuleConfig` object — the single source of
   vertical truth: vocabulary, pipeline columns, job statuses, UI labels, intake
   fields, document templates, automation presets, and the agent persona.
3. `ModuleConfigService.forTenant()` loads it and merges any per-tenant
   `settings.moduleOverrides` on top, so a specific business can rename "Customer"
   to "Member" without a new module.
4. The API serves it at `GET /api/config/module`; the frontend renders labels,
   columns and forms from it. **No vertical-specific React or SQL exists.**

```
Tenant.industryModule ──▶ getModuleConfig() ──▶ IndustryModuleConfig
                                                  ├─ entities (vocabulary)
                                                  ├─ pipeline (board columns)
                                                  ├─ jobStatuses
                                                  ├─ labels (UI strings)
                                                  ├─ intakeFields (agent questions)
                                                  ├─ templates (documents)
                                                  ├─ automations (presets)
                                                  └─ agentPersona (LLM system prompt)
```

## What each module changes

| Aspect | Field Services | Property Mgmt | Service Agencies |
|---|---|---|---|
| Lead called | Service Request | Maintenance Request | Client Lead |
| Job called | Technician Job | Contractor Job / Work Order | Case |
| Contact called | Customer | Tenant | Client |
| Pipeline `QUALIFIED` | "Quoted" | "Triaged" | "Retained" |
| Intake collects | service type, urgency, address | unit, issue, entry permission | matter, email, timeline |
| Key automation | missed-call text-back, emergency dispatch | request routing, rent reminders | intake sequence, document chase |
| Documents | quote, invoice | work order, rent notice | engagement letter, doc checklist |

## Adding a fourth industry

1. Create `packages/config/src/industries/<vertical>.ts` exporting an
   `IndustryModuleConfig`.
2. Register it in `industries/index.ts` and add the enum value to
   `IndustryModule` in `schema.prisma` (one migration).
3. Done — agents, automation engine, dashboard, and intake all adapt with **zero
   further code**, because they only ever read the config.

## Example (excerpt)

```ts
export const fieldServices: IndustryModuleConfig = {
  key: 'FIELD_SERVICES',
  entities: [{ key: 'service_request', singular: 'Service Request', backing: 'lead' }, ...],
  pipeline: [{ value: 'BOOKED', label: 'Scheduled', color: '#10b981' }, ...],
  intakeFields: [{ key: 'urgency', prompt: 'Is this an emergency, or can it wait?', ... }],
  automations: [{ key: 'missed_call_text_back', triggerEvent: 'call.missed', actions: [...] }],
  agentPersona: 'You are the friendly front desk for a field-services company...',
};
```
