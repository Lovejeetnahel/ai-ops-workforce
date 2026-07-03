import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { AUTOMATION_QUEUE, EventBus } from './event-bus';
import { DomainEvent } from './events';
import { ActionHandlers } from './action-handlers';
import { tenantContext } from '../common/tenancy/tenant-context';
import { ControlPlaneService } from '../control/control-plane.service';
import { PolicyRegistry } from '../control/policy/policy.registry';
import { PrismaService } from '../common/prisma/prisma.service';

interface EvaluateJob extends DomainEvent {
  /** When resuming after a WAIT, the index of the rule/action to continue from. */
  _resume?: { ruleIndex: number; actionIndex: number };
}

/**
 * The consumer side of the automation engine, run in the worker process. For
 * each event it resolves matching rules then executes their actions in order.
 * A WAIT action re-enqueues the job with a delay and a resume cursor, so long
 * "wait 2 hours then text" sequences cost nothing while pending.
 *
 * Every job runs inside the tenant's AsyncLocalStorage context so the
 * tenant-scoped Prisma client filters correctly off the main HTTP path.
 *
 * CONTROL LOOP (additive wrap, behavior-preserving):
 *   1. control.observe(event)        — resolve open decisions this event satisfies
 *   2. policy.decide(event)          — RulePolicy → identical to automation.resolve
 *   3. control.aroundAction(meta, …) — open a DecisionRecord, run the SAME action
 * The action executor (`handlers.execute`) is unchanged and always runs.
 */
@Injectable()
export class ActionWorker implements OnModuleDestroy {
  private readonly logger = new Logger(ActionWorker.name);
  private worker?: Worker;

  constructor(
    private readonly handlers: ActionHandlers,
    private readonly bus: EventBus,
    private readonly control: ControlPlaneService,
    private readonly policies: PolicyRegistry,
    private readonly prisma: PrismaService,
  ) {}

  async start() {
    const connection = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
      maxRetriesPerRequest: null,
    });

    this.worker = new Worker<EvaluateJob>(
      AUTOMATION_QUEUE,
      (job) => this.process(job),
      // stalledInterval: how often BullMQ checks for stalled jobs. Halved from
      // the 30s default so a stalled job is detected and re-queued within ~15s
      // instead of up to 30s. lockDuration is explicit (matches BullMQ default)
      // so the relationship between lock lifetime and stall detection is visible.
      { connection, concurrency: 10, stalledInterval: 15_000, lockDuration: 30_000 },
    );

    this.worker.on('failed', async (job, err) => {
      this.logger.error(`Job ${job?.id} failed: ${err.message}`);
      const d = job?.data as any;
      // On final failure of a webhook:deliver job, increment the subscription's
      // failureCount so operators can identify consistently-unreachable endpoints.
      if (d?._type === 'webhook:deliver' && (job?.attemptsMade ?? 0) >= ((job?.opts as any)?.attempts ?? 1)) {
        await this.prisma.webhookSubscription
          .update({ where: { id: d.subId }, data: { failureCount: { increment: 1 } } })
          .catch(() => undefined);
      }
    });
  }

  async onModuleDestroy() {
    // Wait for active jobs to finish before the process exits on SIGTERM.
    // Without this, active jobs lose their lock and are re-queued as stalled
    // on the next worker startup — triggering spurious retries of already-
    // in-progress work.
    await this.worker?.close();
  }

  private async process(job: Job<EvaluateJob>) {
    const event = job.data;

    // Webhook delivery jobs are enqueued by WebhookService when the initial
    // delivery attempt fails. Route them before the automation handler chain.
    if ((event as any)._type === 'webhook:deliver') {
      return this.deliverWebhook(job);
    }

    await tenantContext.run({ tenantId: event.tenantId }, async () => {
      // Feedback half: resolve any open decisions this event satisfies.
      await this.control.observe(event);

      // Decision half: RulePolicy returns exactly what automation.resolve did.
      const { policy, rules } = await this.policies.active().decide(event);
      const startRule = event._resume?.ruleIndex ?? 0;

      for (let r = startRule; r < rules.length; r++) {
        const startAction =
          r === startRule ? event._resume?.actionIndex ?? 0 : 0;

        for (let a = startAction; a < rules[r].actions.length; a++) {
          const action = rules[r].actions[a] as any;

          if (action.type === 'WAIT') {
            const delayMs = this.toMs(action.params);
            await this.bus.queue.add(
              'evaluate',
              { ...event, _resume: { ruleIndex: r, actionIndex: a + 1 } },
              { delay: delayMs, attempts: 5, backoff: { type: 'exponential', delay: 2000 } },
            );
            this.logger.debug(`WAIT ${delayMs}ms — rescheduled ${event.name}`);
            return; // suspend; resumes via the delayed job
          }

          // Wrap each action with a DecisionRecord; the executor is unchanged.
          await this.control.aroundAction(
            { event, policy, ruleName: rules[r].name, ruleIndex: r, actionIndex: a, action },
            () => this.handlers.execute(action, event),
          );

          // Checkpoint after every successfully completed action. Found via
          // load testing: BullMQ retries replay job.data from the start —
          // with no checkpoint, a job that fails on action N re-executes
          // actions 0..N-1 on every retry attempt (5 duplicate SMS sends,
          // duplicate jobs/bookings, etc., for a rule with attempts: 5).
          // Persisting the resume cursor here (the same mechanism already
          // used for WAIT) means a retry picks up at the next action instead
          // of repeating completed ones.
          event._resume = { ruleIndex: r, actionIndex: a + 1 };
          await job.updateData(event);
        }
      }
    });
  }

  private async deliverWebhook(job: Job) {
    const d = job.data as any;
    const res = await fetch(d.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-AIOW-Signature': d.signature },
      body: d.body,
    });
    if (!res.ok) throw new Error(`webhook ${d.subId} HTTP ${res.status}`);
  }

  private toMs(params: any): number {
    if (params?.ms) return Number(params.ms);
    if (params?.minutes) return Number(params.minutes) * 60_000;
    if (params?.hours) return Number(params.hours) * 3_600_000;
    if (params?.days) return Number(params.days) * 86_400_000;
    return 0;
  }
}
