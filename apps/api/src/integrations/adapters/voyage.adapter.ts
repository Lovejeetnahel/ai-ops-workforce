import { Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { EmbeddingPort } from '../ports';

/**
 * Voyage AI embedding adapter (Anthropic's recommended embeddings) for the
 * Business Brain. `voyage-3` returns 1024-dim vectors, matching the pgvector
 * `vector(1024)` columns.
 *
 * When no VOYAGE_API_KEY is set it falls back to a DETERMINISTIC local stub so
 * dev/CI run fully offline: a hashed bag-of-words projected into 1024 dims and
 * L2-normalized. The stub is not semantically meaningful but is stable and
 * non-zero, so ingestion + cosine search work end-to-end without a key.
 */
export class VoyageAdapter implements EmbeddingPort {
  private readonly logger = new Logger(VoyageAdapter.name);
  readonly dimensions = Number(process.env.EMBEDDING_DIMS ?? 1024);
  private readonly model = process.env.EMBEDDING_MODEL ?? 'voyage-3';

  constructor(private readonly apiKey?: string) {}

  async embed(texts: string[], kind: 'document' | 'query' = 'document'): Promise<number[][]> {
    if (texts.length === 0) return [];
    if (!this.apiKey) return texts.map((t) => this.stub(t));

    const res = await fetch('https://api.voyageai.com/v1/embeddings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: texts, model: this.model, input_type: kind }),
    });
    if (!res.ok) throw new Error(`Voyage ${res.status}: ${await res.text()}`);
    const data: any = await res.json();
    return data.data
      .sort((a: any, b: any) => a.index - b.index)
      .map((d: any) => d.embedding as number[]);
  }

  /** Stable hashed pseudo-embedding for offline mode. */
  private stub(text: string): number[] {
    const vec = new Array(this.dimensions).fill(0);
    for (const token of text.toLowerCase().split(/\W+/).filter(Boolean)) {
      const h = createHash('md5').update(token).digest();
      for (let i = 0; i < h.length; i++) {
        vec[(h[i] * 7 + i) % this.dimensions] += (h[i] / 255) * 2 - 1;
      }
    }
    const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
    return vec.map((v) => v / norm);
  }
}
