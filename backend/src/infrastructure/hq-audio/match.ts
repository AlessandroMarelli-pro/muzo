/**
 * Loose normalisation for matching an acquired file's path/name against the
 * artist + title we asked for. Lowercases, strips punctuation, collapses
 * whitespace. Shared by the acquirers that scan an output directory for the
 * file a CLI just produced (Tidal, Qobuz).
 */
export function normalizeForMatch(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
