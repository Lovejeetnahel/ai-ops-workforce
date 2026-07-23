import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { tenantContext } from '../../common/tenancy/tenant-context';
import { Authority } from './employee.types';
import { ToolRegistry } from './tool-registry.service';
import { verdictFor } from './action-risk.policy';

/**
 * THE single enforced tool-execution path for the AI workforce. Every employee
 * tool call — roster agents, the Command Center planner, approval execution —
 * goes through execute(), which applies, in order and deterministically
 * (nothing here is influenced by model output):
 *
 *   1. PERMISSION  — is the tool in this employee's effective allowlist?
 *      (per-tenant AgentInstallation.permissions override, read HERE from the
 *      DB, never trusted from arguments; falls back to the caller-supplied
 *      static AgentDefinition.tools, so enforcement is a behavioral no-op for
 *      existing employees until a tenant tightens it)
 *   2. VALIDATION  — do the arguments match the tool's schema? Approvals store
 *      these validated args verbatim; nothing is ever re-derived from text.
 *   3. AUTHORITY   — independent of permission: SAFE tools execute;
 *      EXTERNAL_IMPACT tools execute only for AUTONOMOUS actors, become a
 *      durable AgentApproval for APPROVE, and are denied for SUGGEST
 *      (action-risk.policy.ts is the one place those rules live).
 *
 * ToolRegistry._rawRun stays internal; controllers and agents never call it.
 * (No EmployeeRegistry dependency by design — that would make a DI cycle
 * Kit → Gateway → Registry → employees → Kit; callers pass their own static
 * definition context instead.)
 */

/** Minimal per-tool argument schemas: required/optional fields. */
const TOOL_ARG_SCHEMAS: Record<string, { required: string[]; optional?: string[] }> = {
  email: { required: ['to', 'subject', 'body'] },
  sms: { required: ['to', 'body'] },
  generate_quote: { required: ['contactId'], optional: ['lineItems', 'notes', 'leadId', 'jobId'] },
  generate_invoice: { required: ['jobId'], optional: ['lineItems'] },
  send_document: { required: ['id'] },
  payment_link: { required: ['documentId'] },
  dispatch_lead: { required: ['leadId'] },
  update_job_status: { required: ['jobId', 'status'] },
  search_knowledge: { required: ['query'], optional: ['role', 'topK'] },
  recall_memory: { required: ['subjectType', 'subjectId'] },
  remember: { required: ['subjectType', 'subjectId', 'kind', 'content'], optional: ['key'] },
  ingest_knowledge: { required: ['type', 'title', 'content'], optional: ['source', 'visibility', 'metadata'] },
  llm: { required: ['system', 'user'], optional: ['maxTokens', '_agentKey', '_taskId'] },
  vision: { required: ['url'], optional: ['hint'] },
  business_snapshot: { required: [] },
  list_leads: { required: [], optional: ['stage', 'take'] },
  list_goals: { required: [], optional: ['department', 'take'] },
  list_overdue_invoices: { required: [], optional: ['olderThanDays'] },
};

export interface GatewayResult {
  status: 'EXECUTED' | 'PENDING_APPROVAL' | 'DENIED';
  result?: unknown;
  approvalId?: string;
  reason?: string;
}

export interface GatewayCallContext {
  /** Static allowlist from the employee's AgentDefinition.tools. */
  defaultTools: string[];
  /** Authority in force for this run (orchestrator-resolved or overridden). */
  authority: Authority;
  taskId?: string;
  reason?: string;
  confidence?: number;
}

/** Pure validation, exported for unit tests. Returns error list (empty = ok). */
export function validateToolArgs(toolName: string, args: Record<string, unknown>): string[] {
  const schema = TOOL_ARG_SCHEMAS[toolName];
  if (!schema) return [`unknown tool: ${toolName}`];
  const errors: string[] = [];
  for (const field of schema.required) {
    const v = args[field];
    if (v === undefined || v === null || (typeof v === 'string' && !v.trim())) errors.push(`missing required argument: ${field}`);
  }
  const allowed = new Set([...schema.required, ...(schema.optional ?? [])]);
  for (const key of Object.keys(args)) {
    if (!allowed.has(key)) errors.push(`unexpected argument: ${key}`);
  }
  return errors;
}

/** Stable idempotency key for one intended action. */
export function actionIdempotencyKey(tenantId: string, agentKey: string, toolName: string, args: Record<string, unknown>, taskId?: string): string {
  const hash = createHash('sha256').update(JSON.stringify({ toolName, args })).digest('hex').slice(0, 32);
  return `${tenantId}:${agentKey}:${taskId ?? 'adhoc'}:${hash}`;
}

const APPROVAL_TTL_MS = 7 * 24 * 60 * 60 * 1000; // pending approvals expire after 7 days

@Injectable()
export class ToolGateway {
  private readonly logger = new Logger(ToolGateway.name);

  constructor(
    private readonly registry: ToolRegistry,
    private readonly prisma: PrismaService,
  ) {}

  /** Effective allowlist: per-tenant permissions override (from DB), else the static default. */
  async effectivePermissions(agentKey: string, defaultTools: string[]): Promise<string[]> {
    const row = await this.prisma.db.agentInstallation.findUnique({
      where: { tenantId_agentKey: { tenantId: tenantContext.tenantId, agentKey } },
      select: { permissions: true },
    });
    if (row?.permissions?.length) return row.permissions;
    return defaultTools;
  }

  async execute(agentKey: string, toolName: string, args: Record<string, unknown>, ctx: GatewayCallContext): Promise<GatewayResult> {
    // 1. Permission — can this employee use this tool at all?
    const allowed = await this.effectivePermissions(agentKey, ctx.defaultTools);
    if (!allowed.includes(toolName)) {
      this.logger.warn(`tool denied (not permitted): agent=${agentKey} tool=${toolName}`);
      return { status: 'DENIED', reason: `Tool "${toolName}" is not in ${agentKey}'s permitted tools.` };
    }

    // 2. Argument validation — approvals must store executable, valid args.
    const argErrors = validateToolArgs(toolName, args);
    if (argErrors.length) {
      return { status: 'DENIED', reason: `Invalid arguments for "${toolName}": ${argErrors.join('; ')}` };
    }

    // 3. Authority × risk — independent of permission.
    const verdict = verdictFor(toolName, ctx.authority);

    if (verdict === 'DENY') {
      return { status: 'DENIED', reason: `"${toolName}" has external impact and ${agentKey} is suggest-only.` };
    }

    if (verdict === 'REQUIRE_APPROVAL') {
      const idempotencyKey = actionIdempotencyKey(tenantContext.tenantId, agentKey, toolName, args, ctx.taskId);
      // One approval per intended action: re-requests return the existing row.
      const existing = await this.prisma.db.agentApproval.findFirst({ where: { idempotencyKey } });
      if (existing) return { status: 'PENDING_APPROVAL', approvalId: existing.id, reason: 'Already awaiting approval.' };
      const approval = await this.prisma.db.agentApproval.create({
        data: {
          agentKey,
          taskId: ctx.taskId ?? null,
          toolName,
          toolArgs: args as any,
          reason: ctx.reason ?? null,
          confidence: ctx.confidence ?? null,
          authority: ctx.authority,
          expiresAt: new Date(Date.now() + APPROVAL_TTL_MS),
          idempotencyKey,
        } as any,
      });
      return { status: 'PENDING_APPROVAL', approvalId: approval.id, reason: 'Requires human approval before executing.' };
    }

    const result = await this.registry._rawRun(toolName, args);
    return { status: 'EXECUTED', result };
  }

  /**
   * Execute a HUMAN-APPROVED action. Skips permission/authority re-checks by
   * design (the human decision IS the authority) but still runs through the
   * raw registry with the stored, validated arguments only.
   * @internal — called only by AgentApprovalsService after its CAS claim.
   */
  executeApproved(toolName: string, args: Record<string, unknown>): Promise<any> {
    return this.registry._rawRun(toolName, args);
  }

  knownTool(toolName: string): boolean {
    return this.registry.has(toolName);
  }

  assertKnown(toolName: string): void {
    if (!this.registry.has(toolName)) throw new ForbiddenException(`Unknown tool: ${toolName}`);
  }

  listTools(): string[] {
    return this.registry.list();
  }
}
