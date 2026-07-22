import { ToolGateway } from './tool-gateway.service';
import { tenantContext } from '../../common/tenancy/tenant-context';

/**
 * Gateway behavior tests with stubbed registry/prisma: permission denial,
 * argument rejection, authority×risk routing (execute vs durable approval vs
 * deny), and approval idempotency (same intent → same pending approval).
 */
function makeGateway(opts: { permissionsOverride?: string[]; existingApproval?: any } = {}) {
  const executed: { name: string; args: any }[] = [];
  const created: any[] = [];
  const registry = {
    has: (n: string) => ['sms', 'business_snapshot'].includes(n),
    list: () => ['sms', 'business_snapshot'],
    _rawRun: async (name: string, args: any) => {
      executed.push({ name, args });
      return { ok: true };
    },
  };
  const prisma = {
    db: {
      agentInstallation: {
        findUnique: async () => (opts.permissionsOverride ? { permissions: opts.permissionsOverride } : null),
      },
      agentApproval: {
        findFirst: async () => opts.existingApproval ?? null,
        create: async ({ data }: any) => {
          created.push(data);
          return { id: 'appr_1', ...data };
        },
      },
    },
  };
  return { gateway: new ToolGateway(registry as any, prisma as any), executed, created };
}

const run = <T>(fn: () => Promise<T>) => tenantContext.run({ tenantId: 'tenant_test' }, fn);

describe('ToolGateway enforcement', () => {
  it('denies tools outside the effective allowlist (permission ≠ authority)', async () => {
    const { gateway, executed } = makeGateway();
    const res = await run(() => gateway.execute('sales', 'sms', { to: '+1', body: 'x' }, { defaultTools: ['business_snapshot'], authority: 'AUTONOMOUS' }));
    expect(res.status).toBe('DENIED');
    expect(executed).toHaveLength(0);
  });

  it('per-tenant permissions override replaces the defaults', async () => {
    const { gateway } = makeGateway({ permissionsOverride: ['business_snapshot'] });
    // sms IS in the defaults, but the tenant narrowed permissions — denied.
    const res = await run(() => gateway.execute('sales', 'sms', { to: '+1', body: 'x' }, { defaultTools: ['sms'], authority: 'AUTONOMOUS' }));
    expect(res.status).toBe('DENIED');
  });

  it('rejects invalid arguments before any execution or approval', async () => {
    const { gateway, executed, created } = makeGateway();
    const res = await run(() => gateway.execute('sales', 'sms', { to: '+1' }, { defaultTools: ['sms'], authority: 'AUTONOMOUS' }));
    expect(res.status).toBe('DENIED');
    expect(res.reason).toContain('missing required argument: body');
    expect(executed).toHaveLength(0);
    expect(created).toHaveLength(0);
  });

  it('AUTONOMOUS + external-impact tool → executes (existing behavior preserved)', async () => {
    const { gateway, executed } = makeGateway();
    const res = await run(() => gateway.execute('sales', 'sms', { to: '+1', body: 'x' }, { defaultTools: ['sms'], authority: 'AUTONOMOUS' }));
    expect(res.status).toBe('EXECUTED');
    expect(executed).toHaveLength(1);
  });

  it('APPROVE + external-impact tool → durable approval with the validated args, nothing executed', async () => {
    const { gateway, executed, created } = makeGateway();
    const res = await run(() => gateway.execute('command_center', 'sms', { to: '+1', body: 'x' }, { defaultTools: ['sms'], authority: 'APPROVE', taskId: 't1', reason: 'why' }));
    expect(res.status).toBe('PENDING_APPROVAL');
    expect(res.approvalId).toBe('appr_1');
    expect(executed).toHaveLength(0);
    expect(created[0].toolArgs).toEqual({ to: '+1', body: 'x' });
    expect(created[0].idempotencyKey).toContain('tenant_test:command_center:t1:');
  });

  it('same intent twice → returns the existing approval instead of a duplicate', async () => {
    const { gateway, created } = makeGateway({ existingApproval: { id: 'appr_existing' } });
    const res = await run(() => gateway.execute('command_center', 'sms', { to: '+1', body: 'x' }, { defaultTools: ['sms'], authority: 'APPROVE', taskId: 't1' }));
    expect(res.status).toBe('PENDING_APPROVAL');
    expect(res.approvalId).toBe('appr_existing');
    expect(created).toHaveLength(0);
  });

  it('SUGGEST + external-impact tool → denied; SAFE tool still executes', async () => {
    const { gateway, executed } = makeGateway();
    const denied = await run(() => gateway.execute('ops', 'sms', { to: '+1', body: 'x' }, { defaultTools: ['sms'], authority: 'SUGGEST' }));
    expect(denied.status).toBe('DENIED');
    const safe = await run(() => gateway.execute('ops', 'business_snapshot', {}, { defaultTools: ['business_snapshot'], authority: 'SUGGEST' }));
    expect(safe.status).toBe('EXECUTED');
    expect(executed).toHaveLength(1);
  });
});
