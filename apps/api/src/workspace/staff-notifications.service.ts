import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { StaffNotificationPriority } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { EventBus } from '../automation/event-bus';
import { DomainEvents, DomainEvent } from '../automation/events';
import { tenantContext } from '../common/tenancy/tenant-context';

interface Spec {
  title: (p: any) => string;
  body?: (p: any) => string | null;
  href: string;
  priority: StaffNotificationPriority;
  /** Target a specific user from the payload; undefined = admin-wide row. */
  userId?: (p: any) => string | null;
}

/** Event → staff notification mapping. Rows come ONLY from real events. */
const SPEC: Record<string, Spec> = {
  [DomainEvents.LEAD_CREATED]: { title: (p) => `New lead${p.contact?.name ? ` — ${p.contact.name}` : ''}`, body: (p) => p.source === 'website_form' ? 'From your website form' : null, href: '/sales', priority: 'NORMAL' },
  [DomainEvents.CONVERSATION_ASSIGNED]: { title: () => 'A conversation was assigned', href: '/conversations', priority: 'NORMAL', userId: (p) => p.conversation?.assignedToId ?? null },
  [DomainEvents.BOOKING_REQUESTED]: { title: (p) => `New appointment request${p.contact?.name ? ` — ${p.contact.name}` : ''}`, href: '/apps/appointments', priority: 'HIGH' },
  [DomainEvents.BOOKING_NO_SHOW]: { title: () => 'Appointment marked no-show', href: '/apps/appointments', priority: 'NORMAL' },
  [DomainEvents.REVIEW_RECEIVED]: { title: (p) => `New ${p.review?.rating ?? ''}★ review`, body: (p) => (p.review?.rating ?? 5) <= 3 ? 'Negative review — respond personally' : null, href: '/marketing', priority: 'NORMAL' },
  [DomainEvents.AGENT_TASK_FAILED]: { title: (p) => `AI task failed${p.agent?.key ? ` (${p.agent.key})` : ''}`, href: '/ai-workforce', priority: 'HIGH' },
  [DomainEvents.CAMPAIGN_COMPLETED]: { title: (p) => `Campaign finished — ${p.sent ?? 0} sent, ${p.failed ?? 0} failed`, href: '/marketing', priority: 'NORMAL' },
  [DomainEvents.GOAL_ACHIEVED]: { title: (p) => `Goal achieved: ${p.goal?.title ?? ''} 🎉`, href: '/business-brain', priority: 'NORMAL' },
  [DomainEvents.CALL_MISSED]: { title: () => 'Missed call', body: (p) => p.from ? `From ${p.from}` : null, href: '/voice-ai', priority: 'HIGH' },
  [DomainEvents.CALL_COMPLETED]: { title: () => 'Voice AI handled a call', href: '/voice-ai', priority: 'NORMAL' },
  [DomainEvents.PAYMENT_SUCCEEDED]: { title: (p) => `Payment received${p.payment?.amount ? ` — $${p.payment.amount}` : ''}`, href: '/payments', priority: 'NORMAL' },
};

/**
 * Staff Notifications Center (Sprint 3). One projector over the existing
 * EventBus (same pattern as the customer NotificationProjector) writing
 * StaffNotification rows: userId-targeted when the event names a user,
 * admin-wide otherwise. Never fabricates a notification without an event.
 */
@Injectable()
export class StaffNotificationsService implements OnModuleInit {
  private readonly logger = new Logger(StaffNotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly bus: EventBus,
  ) {}

  onModuleInit() {
    for (const name of Object.keys(SPEC)) this.bus.on(name, (e) => this.project(name, e));
    this.logger.log(`Staff notification projector listening on ${Object.keys(SPEC).length} event types`);
  }

  private async project(name: string, e: DomainEvent) {
    try {
      const spec = SPEC[name];
      const p: any = e.payload ?? {};
      await this.prisma.db.staffNotification.create({
        data: {
          userId: spec.userId?.(p) ?? null,
          category: name,
          title: spec.title(p).slice(0, 200),
          body: spec.body?.(p)?.slice(0, 500) ?? null,
          href: spec.href,
          priority: spec.priority,
        } as any,
      });
    } catch (err) {
      this.logger.warn(`staff notification for ${name} failed: ${(err as Error).message}`);
    }
  }

  /** Rows visible to me: targeted at me, or admin-wide when I'm ADMIN+. */
  private visibilityWhere() {
    const store = tenantContext.get();
    const isAdmin = ['ADMIN', 'OWNER'].includes(String(store?.role ?? ''));
    return isAdmin ? { OR: [{ userId: store?.userId ?? '' }, { userId: null }] } : { userId: store?.userId ?? '' };
  }

  async list(filter: { unread?: boolean; category?: string; limit?: number }) {
    // Retention: opportunistically drop read rows older than 90 days.
    await this.prisma.db.staffNotification
      .deleteMany({ where: { read: true, createdAt: { lt: new Date(Date.now() - 90 * 86_400_000) } } })
      .catch(() => undefined);
    return this.prisma.db.staffNotification.findMany({
      where: { ...this.visibilityWhere(), ...(filter.unread ? { read: false } : {}), ...(filter.category ? { category: filter.category } : {}) },
      orderBy: { createdAt: 'desc' },
      take: Math.min(filter.limit ?? 50, 200),
    });
  }

  async unreadCount() {
    return { count: await this.prisma.db.staffNotification.count({ where: { ...this.visibilityWhere(), read: false } }) };
  }

  async markRead(id: string) {
    const row = await this.prisma.db.staffNotification.findFirst({ where: { id, ...this.visibilityWhere() }, select: { id: true, tenantId: true } });
    if (!row) throw new NotFoundException('Notification not found');
    return this.prisma.db.staffNotification.update({ where: { id }, data: { read: true, readAt: new Date() } });
  }

  async markAllRead() {
    const res = await this.prisma.db.staffNotification.updateMany({
      where: { ...this.visibilityWhere(), read: false },
      data: { read: true, readAt: new Date() },
    });
    return { marked: res.count };
  }
}
