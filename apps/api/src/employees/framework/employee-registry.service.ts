import { Injectable } from '@nestjs/common';
import { AgentAuthority } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EventBus } from '../../automation/event-bus';
import { DomainEvents } from '../../automation/events';
import { tenantContext } from '../../common/tenancy/tenant-context';
import { BaseEmployeeAgent } from './base-employee.agent';
import { Authority } from './employee.types';
import { SalesEmployee } from '../roster/sales.employee';
import { CustomerSuccessEmployee } from '../roster/customer-success.employee';
import { CollectionsEmployee } from '../roster/collections.employee';
import { RecruitingEmployee } from '../roster/recruiting.employee';
import { OperationsManagerEmployee } from '../roster/operations-manager.employee';
import { MarketingEmployee } from '../roster/marketing.employee';
import { ReceptionistEmployee } from '../roster/receptionist.employee';
import { ExecutiveEmployee } from '../roster/executive.employee';
import { CommandCenterEmployee } from '../roster/command-center.employee';

export interface Installation {
  enabled: boolean;
  authority: Authority;
  config: Record<string, unknown>;
}

/**
 * The AI workforce roster + marketplace installation state. Holds every employee
 * instance and resolves each tenant's install/enable/authority/config from the
 * AgentInstallation table (defaulting to the employee's definition when absent).
 */
@Injectable()
export class EmployeeRegistry {
  private readonly roster = new Map<string, BaseEmployeeAgent>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly bus: EventBus,
    sales: SalesEmployee,
    cs: CustomerSuccessEmployee,
    collections: CollectionsEmployee,
    recruiting: RecruitingEmployee,
    ops: OperationsManagerEmployee,
    marketing: MarketingEmployee,
    receptionist: ReceptionistEmployee,
    executive: ExecutiveEmployee,
    commandCenter: CommandCenterEmployee,
  ) {
    [sales, cs, collections, recruiting, ops, marketing, receptionist, executive, commandCenter].forEach((a) => this.roster.set(a.definition.key, a));
  }

  get(key: string): BaseEmployeeAgent | undefined {
    return this.roster.get(key);
  }

  list() {
    return [...this.roster.values()].map((a) => a.definition);
  }

  /** Resolve a tenant's installation, defaulting to the employee definition. */
  async installation(key: string): Promise<Installation> {
    const def = this.get(key)?.definition;
    const row = await this.prisma.db.agentInstallation.findUnique({
      where: { tenantId_agentKey: { tenantId: tenantContext.tenantId, agentKey: key } },
    });
    return {
      enabled: row?.enabled ?? true,
      // Fail safe: an unknown definition can never imply autonomy.
      authority: (row?.authority ?? def?.defaultAuthority ?? 'APPROVE') as Authority,
      config: (row?.config as any) ?? {},
    };
  }

  async install(key: string, opts: { enabled?: boolean; authority?: AgentAuthority; config?: Record<string, unknown>; permissions?: string[] }) {
    const result = await this.prisma.db.agentInstallation.upsert({
      where: { tenantId_agentKey: { tenantId: tenantContext.tenantId, agentKey: key } },
      update: { enabled: opts.enabled ?? undefined, authority: opts.authority ?? undefined, config: (opts.config as any) ?? undefined, permissions: opts.permissions ?? undefined },
      // Creating a row (e.g. via an enable toggle) must never silently grant
      // more autonomy than the definition's default — authority only rises
      // when it is passed explicitly.
      create: { agentKey: key, enabled: opts.enabled ?? true, authority: opts.authority ?? this.get(key)?.definition.defaultAuthority ?? 'APPROVE', config: (opts.config as any) ?? {}, permissions: opts.permissions ?? [] } as any,
    });
    await this.bus.emit({ name: DomainEvents.AGENT_INSTALLED, tenantId: tenantContext.tenantId, payload: { agentKey: key, enabled: result.enabled } });
    return result;
  }

  setEnabled(key: string, enabled: boolean) {
    return this.install(key, { enabled });
  }
}
