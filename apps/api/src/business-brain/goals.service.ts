import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { GoalPriority, GoalStatus } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { goalHealth } from './goal-math';

export interface GoalInput {
  title?: string;
  description?: string | null;
  priority?: GoalPriority;
  status?: GoalStatus;
  department?: string | null;
  ownerUserId?: string | null;
  agentKeys?: string[];
  parentGoalId?: string | null;
  startAt?: string | null;
  dueAt?: string | null;
}

/**
 * Goals engine. Goals link the whole chain: Business → Goal (→ sub-goals) →
 * department → AI employees (agentKeys) → AgentTasks (goalId) → KPIs
 * (Kpi.goalId). Progress is set by humans or services from real work —
 * nothing here ever advances a goal on its own.
 */
@Injectable()
export class GoalsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(filter?: { status?: GoalStatus; department?: string }) {
    const goals = await this.prisma.db.goal.findMany({
      where: {
        ...(filter?.status ? { status: filter.status } : {}),
        ...(filter?.department ? { department: filter.department } : {}),
      },
      include: { kpis: { select: { id: true, name: true, currentValue: true, targetValue: true, direction: true, unit: true } } },
      orderBy: [{ status: 'asc' }, { priority: 'desc' }, { dueAt: 'asc' }],
      take: 200,
    });
    return Promise.all(goals.map((g) => this.shape(g)));
  }

  async get(id: string) {
    const goal = await this.prisma.db.goal.findUnique({
      where: { id },
      include: { kpis: true },
    });
    if (!goal) throw new NotFoundException('Goal not found');
    const [children, tasks] = await Promise.all([
      this.prisma.db.goal.findMany({ where: { parentGoalId: id }, select: { id: true, title: true, status: true, progress: true } }),
      this.prisma.db.agentTask.findMany({
        where: { goalId: id },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: { id: true, agentKey: true, type: true, status: true, createdAt: true },
      }),
    ]);
    return { ...(await this.shape(goal)), children, recentTasks: tasks };
  }

  async create(input: GoalInput) {
    if (!input.title?.trim()) throw new BadRequestException('Goal title is required.');
    await this.assertValidParent(input.parentGoalId ?? null, null);
    const goal = await this.prisma.db.goal.create({
      data: {
        title: input.title.trim(),
        description: input.description ?? null,
        priority: input.priority ?? 'MEDIUM',
        status: input.status ?? 'ACTIVE',
        department: input.department ?? null,
        ownerUserId: input.ownerUserId ?? null,
        agentKeys: input.agentKeys ?? [],
        parentGoalId: input.parentGoalId ?? null,
        startAt: input.startAt ? new Date(input.startAt) : new Date(),
        dueAt: input.dueAt ? new Date(input.dueAt) : null,
      } as any,
    });
    return this.shape(goal);
  }

  async update(id: string, input: GoalInput) {
    if (input.parentGoalId !== undefined) await this.assertValidParent(input.parentGoalId, id);
    const goal = await this.prisma.db.goal.update({
      where: { id },
      data: {
        ...(input.title !== undefined ? { title: input.title.trim() } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.priority !== undefined ? { priority: input.priority } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.department !== undefined ? { department: input.department } : {}),
        ...(input.ownerUserId !== undefined ? { ownerUserId: input.ownerUserId } : {}),
        ...(input.agentKeys !== undefined ? { agentKeys: input.agentKeys } : {}),
        ...(input.parentGoalId !== undefined ? { parentGoalId: input.parentGoalId } : {}),
        ...(input.startAt !== undefined ? { startAt: input.startAt ? new Date(input.startAt) : null } : {}),
        ...(input.dueAt !== undefined ? { dueAt: input.dueAt ? new Date(input.dueAt) : null } : {}),
      },
    });
    return this.shape(goal);
  }

  /** Progress is an explicit, bounded human/service statement — 0 to 100. */
  async setProgress(id: string, progress: number) {
    if (!Number.isFinite(progress) || progress < 0 || progress > 100) {
      throw new BadRequestException('progress must be between 0 and 100.');
    }
    const rounded = Math.round(progress);
    const goal = await this.prisma.db.goal.update({
      where: { id },
      // Reaching 100 marks the goal achieved; the reverse never happens silently.
      data: { progress: rounded, ...(rounded === 100 ? { status: 'ACHIEVED' } : {}) },
    });
    return this.shape(goal);
  }

  async archive(id: string) {
    return this.prisma.db.goal.update({ where: { id }, data: { status: 'ARCHIVED' } });
  }

  /** Active goals an AI employee supports — by explicit assignment or department. */
  async goalsForAgent(agentKey: string, department?: string, take = 5) {
    return this.prisma.db.goal.findMany({
      where: {
        status: 'ACTIVE',
        OR: [
          { agentKeys: { has: agentKey } },
          ...(department ? [{ department }] : []),
        ],
      },
      orderBy: [{ priority: 'desc' }, { dueAt: 'asc' }],
      take,
      select: { id: true, title: true, priority: true, progress: true, dueAt: true, department: true },
    });
  }

  private async assertValidParent(parentGoalId: string | null, selfId: string | null) {
    if (!parentGoalId) return;
    if (selfId && parentGoalId === selfId) throw new BadRequestException('A goal cannot be its own parent.');
    const parent = await this.prisma.db.goal.findUnique({ where: { id: parentGoalId }, select: { id: true, parentGoalId: true } });
    if (!parent) throw new BadRequestException('parentGoalId does not reference a goal in this business.');
    if (selfId && parent.parentGoalId === selfId) throw new BadRequestException('Goal hierarchy cannot form a cycle.');
  }

  private async shape(goal: any) {
    return { ...goal, health: goalHealth(goal) };
  }
}
