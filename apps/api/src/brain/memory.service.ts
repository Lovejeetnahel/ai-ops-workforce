import { Injectable } from '@nestjs/common';
import { MemoryKind, MemorySubject } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { ProviderFactory } from '../integrations/provider-factory.service';
import { VectorStore } from './vector-store.service';

export interface RecordMemoryInput {
  subjectType: MemorySubject;
  subjectId: string;
  kind: MemoryKind;
  content: string;
  key?: string;
  confidence?: number;
  sourceEventId?: string;
}

/**
 * Persistent per-entity memory (customers, employees, org). Stores both
 * structured rows and semantic vectors so agents can recall relevant facts and
 * personalize. This is what turns "an automation platform" into "an AI that
 * remembers you".
 */
@Injectable()
export class MemoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly providers: ProviderFactory,
    private readonly vectors: VectorStore,
  ) {}

  async record(input: RecordMemoryInput) {
    // Structured upsert: one row per (subject, kind, key) when key is provided.
    const existing = input.key
      ? await this.prisma.db.entityMemory.findFirst({
          where: { subjectType: input.subjectType, subjectId: input.subjectId, kind: input.kind, key: input.key },
        })
      : null;

    const mem = existing
      ? await this.prisma.db.entityMemory.update({
          where: { id: existing.id },
          data: { content: input.content, confidence: input.confidence ?? 1 },
        })
      : await this.prisma.db.entityMemory.create({
          data: {
            subjectType: input.subjectType,
            subjectId: input.subjectId,
            kind: input.kind,
            key: input.key ?? null,
            content: input.content,
            confidence: input.confidence ?? 1,
            sourceEventId: input.sourceEventId ?? null,
          } as any,
        });

    const [vec] = await this.providers.embeddings().embed([input.content], 'document');
    await this.vectors.setMemoryEmbedding(mem.id, vec);
    return mem;
  }

  /** Recent structured memory for a subject (preferences/facts first). */
  recall(subjectType: MemorySubject, subjectId: string, take = 12) {
    return this.prisma.db.entityMemory.findMany({
      where: { subjectType, subjectId },
      orderBy: [{ kind: 'asc' }, { updatedAt: 'desc' }],
      take,
    });
  }

  /** Semantic recall: the memories most relevant to a query. */
  async recallRelevant(subjectType: MemorySubject, subjectId: string, query: string, topK = 5) {
    const [vec] = await this.providers.embeddings().embed([query], 'query');
    return this.recallRelevantByVector(subjectType, subjectId, vec, topK);
  }

  /**
   * Same as `recallRelevant` but takes an already-computed query embedding —
   * see KnowledgeService.searchByVector for why (avoids a duplicate embedding
   * API call per grounded request).
   */
  recallRelevantByVector(subjectType: MemorySubject, subjectId: string, queryVec: number[], topK = 5) {
    return this.vectors.searchMemory(queryVec, subjectType, subjectId, topK);
  }
}
