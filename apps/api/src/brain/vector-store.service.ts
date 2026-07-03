import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { tenantContext } from '../common/tenancy/tenant-context';

export interface ChunkHit {
  id: string;
  docId: string;
  title: string;
  type: string;
  content: string;
  score: number;
}

export interface MemoryHit {
  id: string;
  kind: string;
  content: string;
  score: number;
}

/**
 * Low-level pgvector access for the Business Brain.
 *
 * ⚠️ SECURITY: raw SQL BYPASSES the tenant-scoped Prisma client extension, so
 * EVERY query here injects `tenantId` from tenantContext into the WHERE clause
 * by hand. All values are parameterized ($1, $2, …) — no string interpolation
 * of user input. The embedding vector is passed as a text literal cast to
 * ::vector (pgvector accepts `'[a,b,c]'::vector`).
 */
@Injectable()
export class VectorStore {
  constructor(private readonly prisma: PrismaService) {}

  private literal(vec: number[]): string {
    return `[${vec.join(',')}]`;
  }

  async setChunkEmbedding(chunkId: string, vec: number[]): Promise<void> {
    const tenantId = tenantContext.tenantId;
    await this.prisma.$executeRawUnsafe(
      `UPDATE "KnowledgeChunk" SET embedding = $1::vector WHERE id = $2 AND "tenantId" = $3`,
      this.literal(vec),
      chunkId,
      tenantId,
    );
  }

  async searchChunks(
    queryVec: number[],
    opts: { topK?: number; types?: string[]; visibilities?: string[] } = {},
  ): Promise<ChunkHit[]> {
    const tenantId = tenantContext.tenantId;
    const topK = opts.topK ?? 6;
    const params: unknown[] = [this.literal(queryVec), tenantId];
    let where = `c."tenantId" = $2 AND c.embedding IS NOT NULL AND d.archived = false`;

    if (opts.types?.length) {
      const placeholders = opts.types.map((t) => {
        params.push(t);
        return `$${params.length}`;
      });
      where += ` AND d.type::text IN (${placeholders.join(',')})`;
    }
    if (opts.visibilities?.length) {
      const placeholders = opts.visibilities.map((v) => {
        params.push(v);
        return `$${params.length}`;
      });
      where += ` AND d.visibility::text IN (${placeholders.join(',')})`;
    }

    params.push(topK);
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT c.id, c."docId" AS "docId", c.content, d.type::text AS type, d.title,
              1 - (c.embedding <=> $1::vector) AS score
         FROM "KnowledgeChunk" c
         JOIN "KnowledgeDoc" d ON d.id = c."docId"
        WHERE ${where}
        ORDER BY c.embedding <=> $1::vector
        LIMIT $${params.length}`,
      ...params,
    );
    return rows.map((r) => ({ ...r, score: Number(r.score) }));
  }

  async setMemoryEmbedding(memoryId: string, vec: number[]): Promise<void> {
    const tenantId = tenantContext.tenantId;
    await this.prisma.$executeRawUnsafe(
      `UPDATE "EntityMemory" SET embedding = $1::vector WHERE id = $2 AND "tenantId" = $3`,
      this.literal(vec),
      memoryId,
      tenantId,
    );
  }

  async searchMemory(
    queryVec: number[],
    subjectType: string,
    subjectId: string,
    topK = 5,
  ): Promise<MemoryHit[]> {
    const tenantId = tenantContext.tenantId;
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT id, kind::text AS kind, content,
              1 - (embedding <=> $1::vector) AS score
         FROM "EntityMemory"
        WHERE "tenantId" = $2 AND "subjectType"::text = $3 AND "subjectId" = $4
          AND embedding IS NOT NULL
        ORDER BY embedding <=> $1::vector
        LIMIT $5`,
      this.literal(queryVec),
      tenantId,
      subjectType,
      subjectId,
      topK,
    );
    return rows.map((r) => ({ ...r, score: Number(r.score) }));
  }
}
