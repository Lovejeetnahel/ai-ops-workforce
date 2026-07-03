# Automation Engine

An event-driven workflow engine: **triggers → conditions → ordered actions**.
Source: [apps/api/src/automation](../apps/api/src/automation).

## Pieces

| File | Role |
|---|---|
| `events.ts` | Canonical domain-event catalog (stable string names) |
| `event-bus.ts` | Emit: persist to `EventLog` (idempotent), fan out in-process, enqueue to BullMQ |
| `automation.service.ts` | Resolve matching rules for an event (module presets + tenant rules) |
| `rule-engine.ts` | Condition evaluation + `{{token}}` interpolation |
| `action-handlers.ts` | Execute one action (SMS/email/stage/task/agent/doc/wait) |
| `action.worker.ts` | Worker process: drains the queue, runs actions, handles `WAIT` |

## Flow

```
 producer (agent / controller / service)
        │  bus.emit({ name, tenantId, payload, externalId? })
        ▼
   EventLog (idempotency: unique tenant+source+externalId)
        ├──▶ in-process EventEmitter   (synchronous reactors)
        └──▶ BullMQ "automation" queue (durable, retried)
                       │
                       ▼   worker
              AutomationService.resolve(event)
                 = module presets ⊕ tenant AutomationRules
                   filtered by triggerEvent + matched conditions
                       │
                       ▼  in order
              ActionHandlers.execute(action, event)
                 SEND_SMS · SEND_EMAIL · UPDATE_STAGE · CREATE_TASK
                 ASSIGN_STAFF · TRIGGER_AGENT · GENERATE_DOCUMENT
                 CREATE_BOOKING · WAIT
```

## Triggers (examples)

`call.missed` · `call.completed` · `message.received` · `lead.created` ·
`lead.stage_changed` · `booking.requested` · `booking.no_show` ·
`job.assigned` · `job.completed` · `document.generated` · `payment.succeeded` ·
time-based: `schedule.rent_due_soon`, `schedule.lead_stale`,
`schedule.maintenance_window` (emitted by a scheduler/cron).

## Conditions

A small JSON structure evaluated against the event payload via dot-paths:

```json
{ "path": "lead.urgency", "op": "eq", "value": "EMERGENCY" }
```

Operators: `eq, neq, in, gt, lt, exists, contains`. A rule fires when **all** of
its conditions pass.

## Actions

```json
[
  { "type": "SEND_SMS", "params": { "template": "Sorry we missed you! {{bookingUrl}}" } },
  { "type": "TRIGGER_AGENT", "params": { "agent": "dispatch", "strategy": "nearest_oncall" } },
  { "type": "WAIT", "params": { "hours": 2 } },
  { "type": "SEND_SMS", "params": { "template": "How did we do, {{contact.name}}?" } }
]
```

`WAIT` is special: the worker re-enqueues the job with a `delay` and a resume
cursor `{ ruleIndex, actionIndex }`, so a "wait 2 hours then text" sequence costs
nothing while pending and survives restarts.

## Rules = presets ⊕ tenant overrides

- **Presets** ship with each industry module (`config.automations`) and are
  seeded into `AutomationRule` on tenant signup (`AutomationService.seedPresets`).
- **Tenant rules** are authored in the dashboard (`/api/automation/rules`) and
  layered on top. Both are matched for every event.

## Reliability

- **Idempotency:** duplicate provider webhooks (same `source`+`externalId`) are
  dropped at emit time.
- **Retries:** BullMQ `attempts: 5` with exponential backoff.
- **Tenant safety:** every worker job runs inside the tenant's
  `AsyncLocalStorage` context, so the tenant-scoped Prisma client filters
  correctly off the HTTP path.
- **Graceful drain:** `enableShutdownHooks` + BullMQ finishes in-flight jobs on
  SIGTERM.
