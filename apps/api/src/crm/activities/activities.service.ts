import { Injectable } from '@nestjs/common';
import { ActivityType, ActivityStatus, Actor, MemoryKind, MemorySubject } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { BusinessBrainService } from '../../brain/business-brain.service';

export interface ActivityInput {
  type: ActivityType;
  title: string;
  body?: string;
  actor?: Actor;
  authorUserId?: string;
  assigneeId?: string;
  dueAt?: Date | string;
  contactId?: string;
  companyId?: string;
  leadId?: string;
  jobId?: string;
  sourceEventId?: string;
  metadata?: Record<string, unknown>;
}

export interface SubjectFilter {
  contactId?: string;
  companyId?: string;
  leadId?: string;
  jobId?: string;
}

/**
 * The universal activity timeline. ONE entity backs notes, tasks, and every
 * logged/auto-projected touchpoint, so a single query yields a 360° history for
 * any contact/company/lead/job — identical across all industries.
 *
 * AI reuse: human NOTES about a customer are written into the Business Brain as
 * EntityMemory, so AI agents personalize future interactions automatically.
 */
@Injectable()
export class ActivitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly brain: BusinessBrainService,
  ) {}

  async create(input: ActivityInput) {
    const activity = await this.prisma.db.activity.create({
      data: {
        type: input.type,
        title: input.title,
        body: input.body ?? null,
        actor: input.actor ?? 'SYSTEM',
        authorUserId: input.authorUserId ?? null,
        assigneeId: input.assigneeId ?? null,
        dueAt: input.dueAt ? new Date(input.dueAt) : null,
        contactId: input.contactId ?? null,
        companyId: input.companyId ?? null,
        leadId: input.leadId ?? null,
        jobId: input.jobId ?? null,
        sourceEventId: input.sourceEventId ?? null,
        metadata: (input.metadata ?? {}) as any,
      } as any,
    });

    // A note about a customer becomes durable AI memory.
    if (input.type === 'NOTE' && input.contactId) {
      try {
        await this.brain.remember({
          subjectType: MemorySubject.CUSTOMER,
          subjectId: input.contactId,
          kind: MemoryKind.FACT,
          content: input.body ? `${input.title}: ${input.body}` : input.title,
        });
      } catch {
        /* memory is best-effort; never block activity creation */
      }
    }
    return activity;
  }

  /** 360° timeline for a subject (most recent first). */
  timeline(filter: SubjectFilter, take = 100) {
    const or = this.subjectOr(filter);
    if (or.length === 0) return Promise.resolve([]);
    return this.prisma.db.activity.findMany({
      where: { OR: or },
      orderBy: { createdAt: 'desc' },
      take,
    });
  }

  /** Open tasks (optionally for one assignee), soonest due first. */
  tasks(filter: { status?: ActivityStatus; assigneeId?: string } = {}, take = 100) {
    return this.prisma.db.activity.findMany({
      where: {
        type: 'TASK',
        ...(filter.status ? { status: filter.status } : {}),
        ...(filter.assigneeId ? { assigneeId: filter.assigneeId } : {}),
      },
      orderBy: [{ status: 'asc' }, { dueAt: 'asc' }],
      take,
    });
  }

  update(id: string, data: Partial<Pick<ActivityInput, 'title' | 'body' | 'assigneeId' | 'dueAt'>> & { status?: ActivityStatus }) {
    return this.prisma.db.activity.update({
      where: { id },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.body !== undefined ? { body: data.body } : {}),
        ...(data.assigneeId !== undefined ? { assigneeId: data.assigneeId } : {}),
        ...(data.dueAt !== undefined ? { dueAt: data.dueAt ? new Date(data.dueAt) : null } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
      },
    });
  }

  completeTask(id: string) {
    return this.prisma.db.activity.update({
      where: { id },
      data: { status: 'DONE', completedAt: new Date() },
    });
  }

  private subjectOr(filter: SubjectFilter) {
    const or: any[] = [];
    if (filter.contactId) or.push({ contactId: filter.contactId });
    if (filter.companyId) or.push({ companyId: filter.companyId });
    if (filter.leadId) or.push({ leadId: filter.leadId });
    if (filter.jobId) or.push({ jobId: filter.jobId });
    return or;
  }
}
