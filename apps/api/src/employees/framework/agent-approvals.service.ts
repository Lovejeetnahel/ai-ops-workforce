import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EventBus } from '../../automation/event-bus';
import { DomainEvents } from '../../automation/events';
import { tenantContext } from '../../common/tenancy/tenant-context';
import { ToolGateway } from './tool-gateway.service';

/**
 * Durable human approvals for AI-employee actions. An AgentApproval row holds
 * the FULLY VALIDATED tool call captured at request time; approving replays
 * exactly those stored arguments — never anything re-derived from text.
 *
 * Exactly-once execution: approve() first CLAIMS the row via a compare-and-
 * swap updateMany(PENDING → APPROVED); only the caller whose CAS matched
 * (count === 1) proceeds to execute. Concurrent approvers, double-clicks and
 * API restarts therefore cannot double-fire an action: after a crash between
 * claim and execution the row sits in APPROVED (visibly stuck, never silently
 * re-run) and support can resolve it with full context from the row itself.
 */
@Injectable()
export class AgentApprovalsService {
  private readonly logger = new Logger(AgentApprovalsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: ToolGateway,
    private readonly bus: EventBus,
  ) {}

  /** Pending approvals for the current tenant (expired ones lazily marked). */
  async listPending() {
    await this.expireSweep();
    return this.prisma.db.agentApproval.findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async listRecent(take = 50) {
    return this.prisma.db.agentApproval.findMany({
      where: { status: { in: ['APPROVED', 'REJECTED', 'EXPIRED', 'EXECUTED', 'FAILED'] } },
      orderBy: { updatedAt: 'desc' },
      take,
    });
  }

  /**
   * Approve + execute exactly once. approverId comes from the authenticated
   * server context (never the request body).
   */
  async approve(id: string, approverId: string) {
    const row = await this.prisma.db.agentApproval.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Approval not found');
    if (row.status !== 'PENDING') throw new BadRequestException(`Approval is ${row.status.toLowerCase()}, not pending.`);
    if (row.expiresAt < new Date()) {
      await this.prisma.db.agentApproval.update({ where: { id }, data: { status: 'EXPIRED' } });
      throw new BadRequestException('Approval has expired — ask the employee to propose the action again.');
    }

    // CAS claim: only one caller wins the PENDING → APPROVED transition.
    const claimed = await this.prisma.db.agentApproval.updateMany({
      where: { id, status: 'PENDING' },
      data: { status: 'APPROVED', approvedById: approverId, approvedAt: new Date() },
    });
    if (claimed.count !== 1) throw new BadRequestException('Approval was just resolved by someone else.');

    try {
      const result = await this.gateway.executeApproved(row.toolName, row.toolArgs as Record<string, unknown>);
      const updated = await this.prisma.db.agentApproval.update({
        where: { id },
        data: { status: 'EXECUTED', executedAt: new Date(), executionResult: (result ?? {}) as any },
      });
      await this.bus.emit({
        name: DomainEvents.AGENT_DECISION_MADE,
        tenantId: tenantContext.tenantId,
        payload: { approvalId: id, agentKey: row.agentKey, toolName: row.toolName, outcome: 'executed' },
      });
      return updated;
    } catch (err) {
      const message = (err as Error).message;
      this.logger.error(`approved action failed: approval=${id} tool=${row.toolName}: ${message}`);
      return this.prisma.db.agentApproval.update({
        where: { id },
        data: { status: 'FAILED', executionResult: { error: message } as any },
      });
    }
  }

  /** Reject: terminal, never executes. */
  async reject(id: string, approverId: string) {
    const claimed = await this.prisma.db.agentApproval.updateMany({
      where: { id, status: 'PENDING' },
      data: { status: 'REJECTED', approvedById: approverId, approvedAt: new Date() },
    });
    if (claimed.count !== 1) {
      const row = await this.prisma.db.agentApproval.findUnique({ where: { id } });
      if (!row) throw new NotFoundException('Approval not found');
      throw new BadRequestException(`Approval is ${row.status.toLowerCase()}, not pending.`);
    }
    return this.prisma.db.agentApproval.findUnique({ where: { id } });
  }

  /** Mark past-due PENDING rows EXPIRED (called lazily from listPending). */
  private async expireSweep() {
    await this.prisma.db.agentApproval.updateMany({
      where: { status: 'PENDING', expiresAt: { lt: new Date() } },
      data: { status: 'EXPIRED' },
    });
  }
}
