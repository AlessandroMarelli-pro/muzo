/**
 * Maps `items` through `fn` with at most `concurrency` in flight at once,
 * preserving input order in the result. A simple chunked Promise.all — the
 * same pattern already used ad-hoc in tidal-sync.adapter — hoisted so the HQ
 * audio cascade and batch pre-pass can share it.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const limit = Math.max(1, Math.floor(concurrency));
  const results: R[] = new Array(items.length);
  for (let i = 0; i < items.length; i += limit) {
    const chunk = items.slice(i, i + limit);
    const settled = await Promise.all(chunk.map((item, j) => fn(item, i + j)));
    for (let j = 0; j < settled.length; j++) {
      results[i + j] = settled[j];
    }
  }
  return results;
}
