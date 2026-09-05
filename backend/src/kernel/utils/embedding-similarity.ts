/**
 * Cosine distance between two equal-length embedding vectors: `1 - cos(a,b)`.
 * Range [0, 2] — 0 means identical direction, 2 means opposite. Used for
 * in-application pairwise scoring over small candidate sets (e.g. a single
 * playlist's tracks) where a pgvector SQL query would be overkill.
 */
export function cosineDistance(a?: number[], b?: number[]): number | null {
  if (!a || !b || a.length === 0 || b.length === 0 || a.length !== b.length) {
    return null;
  }
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  if (magA === 0 || magB === 0) {
    return null;
  }
  const cosineSimilarity = dot / (Math.sqrt(magA) * Math.sqrt(magB));
  return 1 - cosineSimilarity;
}
