-- Enable pgvector, add a native vector column for the discogs-effnet embedding,
-- and backfill it from the existing JSON-stringified `embedding` column.
--
-- `embedding` (String) is kept as-is for now, for safe rollback -- drop it in a
-- later migration once `embeddingVector` is verified in production.
--
-- This replaces Elasticsearch's brute-force `script_score` cosine similarity
-- (see the now-deleted elasticsearch/ adapter) with pgvector's `<=>` cosine
-- distance operator. No ivfflat/hnsw index yet: an unindexed exact scan was
-- benchmarked at 15-220ms over the ~7.7k-track ES corpus this replaces, which
-- is cheap enough at this scale. Revisit with an ANN index if the library
-- grows towards ~100k tracks.

CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE "audio_fingerprints" ADD COLUMN "embeddingVector" vector(1280);

-- `embedding` is a JSON array literal (e.g. "[0.1,0.2,...]"), which is also
-- valid pgvector text input syntax, so a direct cast backfills every row that
-- has a real (non-empty) embedding.
UPDATE "audio_fingerprints"
SET "embeddingVector" = "embedding"::vector
WHERE "embedding" IS NOT NULL AND "embedding" != '[]';
