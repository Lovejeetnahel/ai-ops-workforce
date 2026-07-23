import { Injectable } from '@nestjs/common';
import { KnowledgeType, MemorySubject } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { ProviderFactory } from '../integrations/provider-factory.service';
import { KnowledgeService, IngestInput, visibilitiesForRole } from './knowledge.service';
import { MemoryService, RecordMemoryInput } from './memory.service';
import { ChunkHit, MemoryHit } from './vector-store.service';

/**
 * The Business Brain — the single, tenant-scoped intelligence facade every AI
 * agent and surface (assistant, dashboard, portal, copilot) talks to. It unifies
 * KNOWLEDGE (RAG) and MEMORY (per-entity) behind one API so callers never reach
 * into vector internals.
 */
@Injectable()
export class BusinessBrainService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly providers: ProviderFactory,
    private readonly knowledge: KnowledgeService,
    private readonly memory: MemoryService,
  ) {}

  // ── Knowledge ──────────────────────────────────────────────────────────
  ingest(input: IngestInput) {
    return this.knowledge.ingest(input);
  }
  search(query: string, opts?: Parameters<KnowledgeService['search']>[1]): Promise<ChunkHit[]> {
    return this.knowledge.search(query, opts);
  }
  listKnowledge(role?: string) {
    return this.knowledge.list(role);
  }
  reviseKnowledge(id: string, input: Partial<IngestInput>) {
    return this.knowledge.revise(id, input);
  }
  archiveKnowledge(id: string) {
    return this.knowledge.archive(id);
  }

  // ── Memory ─────────────────────────────────────────────────────────────
  remember(input: RecordMemoryInput) {
    return this.memory.record(input);
  }
  recall(subjectType: MemorySubject, subjectId: string) {
    return this.memory.recall(subjectType, subjectId);
  }
  recallRelevant(subjectType: MemorySubject, subjectId: string, query: string) {
    return this.memory.recallRelevant(subjectType, subjectId, query);
  }

  /**
   * Embeds `query` ONCE and runs knowledge search + (optional) memory recall
   * against that single vector — the combined retrieval BrainContextService
   * needs for every grounded agent/employee/portal call. Halves embedding API
   * calls versus calling `search` and `recallRelevant` separately (AI cost).
   */
  async retrieveGrounded(
    query: string,
    opts: { role?: string; topK?: number; subject?: { type: MemorySubject; id: string } },
  ): Promise<{ knowledge: ChunkHit[]; memory: MemoryHit[] }> {
    const [queryVec] = await this.providers.embeddings().embed([query], 'query');
    const [knowledge, memory] = await Promise.all([
      this.knowledge.searchByVector(queryVec, { role: opts.role, topK: opts.topK ?? 6 }),
      opts.subject ? this.memory.recallRelevantByVector(opts.subject.type, opts.subject.id, queryVec) : Promise.resolve([]),
    ]);
    return { knowledge, memory };
  }

  /**
   * Sprint 1: structured company truth for agent grounding — the
   * CompanyProfile record plus the ACTIVE goals this agent supports (explicit
   * agentKeys assignment or same department, highest priority first). Read
   * directly from the tenant-scoped tables; the management APIs live in
   * BusinessBrainModule. Cheap (two indexed queries), no embeddings.
   */
  async companyFacts(agent?: { key?: string; department?: string }) {
    const [profile, goals] = await Promise.all([
      this.prisma.db.companyProfile.findFirst(),
      this.prisma.db.goal.findMany({
        where: {
          status: 'ACTIVE',
          ...(agent?.key || agent?.department
            ? {
                OR: [
                  ...(agent.key ? [{ agentKeys: { has: agent.key } }] : []),
                  ...(agent.department ? [{ department: agent.department }] : []),
                  // Company-wide goals (no department, no assignment) apply to everyone.
                  { AND: [{ department: null }, { agentKeys: { isEmpty: true } }] },
                ],
              }
            : {}),
        },
        orderBy: [{ priority: 'desc' }, { dueAt: 'asc' }],
        take: 5,
        select: { id: true, title: true, priority: true, progress: true, dueAt: true, department: true },
      }),
    ]);
    return { profile, goals };
  }

  /**
   * The structured "who is this business" snapshot used to ground every agent:
   * profile + services + pricing, role-filtered. Cheap, no embeddings.
   */
  async businessProfile(role?: string) {
    const docs = await this.prisma.db.knowledgeDoc.findMany({
      where: {
        archived: false,
        type: { in: ['PROFILE', 'SERVICE', 'PRICING', 'POLICY'] as KnowledgeType[] },
        visibility: { in: visibilitiesForRole(role) },
      },
      orderBy: { type: 'asc' },
      take: 12,
      select: { type: true, title: true, content: true },
    });
    return docs;
  }
}
