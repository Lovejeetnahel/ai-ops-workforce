-- HNSW approximate nearest-neighbour indexes on pgvector embedding columns.
-- Uses vector_cosine_ops to match the <=> cosine-distance operator in
-- VectorStore.searchChunks and VectorStore.searchMemory.
--
-- NOTE for operators: on a database with existing data, run these manually
-- with CONCURRENTLY to avoid locking:
--   CREATE INDEX CONCURRENTLY IF NOT EXISTS "KnowledgeChunk_embedding_hnsw_idx"
--     ON "KnowledgeChunk" USING hnsw (embedding vector_cosine_ops);
--   CREATE INDEX CONCURRENTLY IF NOT EXISTS "EntityMemory_embedding_hnsw_idx"
--     ON "EntityMemory" USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS "KnowledgeChunk_embedding_hnsw_idx"
  ON "KnowledgeChunk" USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS "EntityMemory_embedding_hnsw_idx"
  ON "EntityMemory" USING hnsw (embedding vector_cosine_ops);
