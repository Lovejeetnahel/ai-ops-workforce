import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { tenantContext } from '../common/tenancy/tenant-context';
import { CampaignsService } from './campaigns.service';

const SWEEP_MS = 60_000;
const BATCH = 10;

/**
 * Sprint 4: scheduled campaign execution. Mirrors the proven employee-scheduler
 * design — a 60s sweep over due SCHEDULED campaigns; the actual claim is the
 * CAS inside CampaignsService.start() (SCHEDULED→ACTIVE updateMany), so two
 * API instances (or a human clicking Start at the same moment) can never
 * double-run a campaign, and every send stays per-recipient idempotent.
 *
 * `scheduledAt` is an absolute timestamp (the UI captures it in the tenant's
 * timezone and submits ISO), so the sweep itself is timezone-agnostic.
 *
 * Honesty rules preserved: a due campaign WITHOUT admin approval is never
 * auto-sent — it stays SCHEDULED and the admins get ONE notification (marked
 * in meta.approvalNotifiedAt) until someone approves or cancels it. A due
 * campaign whose provider is unconfigured or which trips a plan limit is set
 * to PAUSED with the reason recorded — never silently dropped, never faked.
 */
@Injectable()
export class CampaignSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CampaignSchedulerService.name);
  private timer?: NodeJS.Timeout;
  private sweeping = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly campaigns: CampaignsService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.sweep().catch((e) => this.logger.error(`sweep failed: ${e.message}`)), SWEEP_MS);
    this.logger.log('Campaign scheduler armed (60s sweep, CAS-claimed starts)');
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /** One pass over all tenants' due scheduled campaigns. Exported for tests. */
  async sweep(): Promise<{ started: number; blocked: number }> {
    if (this.sweeping) return { started: 0, blocked: 0 };
    this.sweeping = true;
    let started = 0;
    let blocked = 0;
    try {
      // Cross-tenant read via the base client (no ambient tenant context).
      const due = await this.prisma.campaign.findMany({
        where: { status: 'SCHEDULED', isTemplate: false, scheduledAt: { lte: new Date() } },
        take: BATCH,
        orderBy: { scheduledAt: 'asc' },
      });
      for (const campaign of due) {
        try {
          await tenantContext.run({ tenantId: campaign.tenantId }, async () => {
            const tenant = await this.prisma.tenant.findUnique({ where: { id: campaign.tenantId }, select: { status: true } });
            if (tenant?.status !== 'ACTIVE') return;
            if (!campaign.approvedAt) {
              await this.notifyApprovalNeededOnce(campaign);
              blocked++;
              return;
            }
            await this.campaigns.start(campaign.id);
            started++;
          });
        } catch (err) {
          blocked++;
          await this.pauseWithReason(campaign.id, campaign.tenantId, (err as Error).message ?? 'start failed');
        }
      }
    } finally {
      this.sweeping = false;
    }
    if (started || blocked) this.logger.log(`Campaign sweep: ${started} started, ${blocked} blocked`);
    return { started, blocked };
  }

  private async notifyApprovalNeededOnce(campaign: { id: string; tenantId: string; name: string; meta: unknown }) {
    const meta = (campaign.meta as any) ?? {};
    if (meta.approvalNotifiedAt) return;
    await this.prisma.campaign.update({
      where: { id: campaign.id },
      data: { meta: { ...meta, approvalNotifiedAt: new Date().toISOString() } as any },
    });
    await this.prisma.staffNotification.create({
      data: {
        tenantId: campaign.tenantId,
        userId: null,
        category: 'campaign.approval_needed',
        title: `Scheduled campaign “${campaign.name}” needs approval`,
        body: 'Its send time has passed but it has not been approved. Approve it to send, or cancel it.',
        href: '/marketing',
        priority: 'HIGH',
      },
    });
  }

  private async pauseWithReason(campaignId: string, tenantId: string, reason: string) {
    try {
      const fresh = await this.prisma.campaign.findUnique({ where: { id: campaignId } });
      if (!fresh || !['SCHEDULED', 'ACTIVE'].includes(fresh.status)) return;
      await this.prisma.campaign.update({
        where: { id: campaignId },
        data: { status: 'PAUSED', meta: { ...((fresh.meta as any) ?? {}), pausedReason: reason.slice(0, 300), pausedAt: new Date().toISOString() } as any },
      });
      await this.prisma.staffNotification.create({
        data: {
          tenantId,
          userId: null,
          category: 'campaign.blocked',
          title: `Scheduled campaign paused: ${fresh.name}`,
          body: reason.slice(0, 280),
          href: '/marketing',
          priority: 'HIGH',
        },
      });
    } catch (err) {
      this.logger.warn(`pauseWithReason failed for ${campaignId}: ${(err as Error).message}`);
    }
  }
}
