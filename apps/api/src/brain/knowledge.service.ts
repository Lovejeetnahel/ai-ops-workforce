import { Injectable, Logger } from '@nestjs/common';
import { KnowledgeType, KnowledgeVisibility, UserRole } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { ProviderFactory } from '../integrations/provider-factory.service';
import { VectorStore, ChunkHit } from './vector-store.service';
import { chunkText, estimateTokens } from './chunking';

export interface IngestInput {
  type: KnowledgeType;
  title: string;
  content: string;
  source?: string;
  visibility?: KnowledgeVisibility;
  metadata?: Record<string, unknown>;
}

/** Which knowledge tiers a role may retrieve. Customer portal sees PUBLIC only. */
export function visibilitiesForRole(role?: string): KnowledgeVisibility[] {
  switch (role) {
    case 'OWNER':
    case 'ADMIN':
      return ['PUBLIC', 'INTERNAL', 'RESTRICTED'];
    case 'STAFF':
      return ['PUBLIC', 'INTERNAL'];
    default:
      return ['PUBLIC']; // CUSTOMER / portal / unauthenticated
  }
}

/**
 * Owns business knowledge: ingestion (chunk → embed → store), semantic search,
 * versioning, and role-aware listing. All writes go through the tenant-scoped
 * Prisma client (`prisma.db`); embeddings are written via VectorStore (raw SQL).
 */
@Injectable()
export class KnowledgeService {
  private readonly logger = new Logger(KnowledgeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly providers: ProviderFactory,
    private readonly vectors: VectorStore,
  ) {}

  async ingest(input: IngestInput) {
    const doc = await this.prisma.db.knowledgeDoc.create({
      data: {
        type: input.type,
        title: input.title,
        content: input.content,
        source: input.source ?? 'manual',
        visibility: input.visibility ?? 'INTERNAL',
        metadata: (input.metadata ?? {}) as any,
      } as any,
    });

    const pieces = chunkText(input.content);
    if (pieces.length === 0) return doc;

    // Persist chunk rows (tenant injected), then embed + attach vectors.
    const chunkRows = [];
    for (let i = 0; i < pieces.length; i++) {
      chunkRows.push(
        await this.prisma.db.knowledgeChunk.create({
          data: { docId: doc.id, ordinal: i, content: pieces[i], tokens: estimateTokens(pieces[i]) } as any,
        }),
      );
    }

    const embeddings = await this.providers.embeddings().embed(pieces, 'document');
    for (let i = 0; i < chunkRows.length; i++) {
      await this.vectors.setChunkEmbedding(chunkRows[i].id, embeddings[i]);
    }

    this.logger.debug(`Ingested "${input.title}" (${pieces.length} chunks)`);
    return doc;
  }

  /** Semantic search, filtered to what the caller's role may see. */
  async search(
    query: string,
    opts: { role?: UserRole | string; types?: KnowledgeType[]; topK?: number } = {},
  ): Promise<ChunkHit[]> {
    const [queryVec] = await this.providers.embeddings().embed([query], 'query');
    return this.searchByVector(queryVec, opts);
  }

  /**
   * Same as `search` but takes an already-computed query embedding. Used by
   * BrainContextService to embed a query ONCE and reuse it for both knowledge
   * search and memory recall, instead of issuing two embedding API calls for
   * the same text on every grounded agent/employee/portal request (cost).
   */
  searchByVector(
    queryVec: number[],
    opts: { role?: UserRole | string; types?: KnowledgeType[]; topK?: number } = {},
  ): Promise<ChunkHit[]> {
    return this.vectors.searchChunks(queryVec, {
      topK: opts.topK ?? 6,
      types: opts.types,
      visibilities: visibilitiesForRole(opts.role as string),
    });
  }

  list(role?: string) {
    return this.prisma.db.knowledgeDoc.findMany({
      where: { archived: false, visibility: { in: visibilitiesForRole(role) } },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, type: true, title: true, source: true, visibility: true, version: true, updatedAt: true },
    });
  }

  /** Edit = create a new version and supersede the old (preserves history). */
  async revise(id: string, input: Partial<IngestInput>) {
    const prev = await this.prisma.db.knowledgeDoc.findUniqueOrThrow({ where: { id } });
    const next = await this.ingest({
      type: (input.type ?? prev.type) as KnowledgeType,
      title: input.title ?? prev.title,
      content: input.content ?? prev.content,
      source: input.source ?? prev.source ?? undefined,
      visibility: (input.visibility ?? prev.visibility) as KnowledgeVisibility,
      metadata: (input.metadata ?? (prev.metadata as any)) as any,
    });
    await this.prisma.db.knowledgeDoc.update({
      where: { id },
      data: { archived: true, supersededById: next.id },
    });
    await this.prisma.db.knowledgeDoc.update({
      where: { id: next.id },
      data: { version: prev.version + 1 },
    });
    return next;
  }

  async archive(id: string) {
    return this.prisma.db.knowledgeDoc.update({ where: { id }, data: { archived: true } });
  }
}
