/**
 * Camelot wheel harmonic-mixing neighbors (Open Key / Camelot notation).
 * Compatible keys: same slot, +/-1 on the wheel (same letter), and parallel mode (swap A/B).
 */
const CAMELOT_KEY_PATTERN = /^(\d{1,2})([AB])$/i;

export function getCamelotNeighbors(camelotKey: string | undefined): string[] {
  if (!camelotKey || camelotKey.trim() === '' || camelotKey.toLowerCase() === 'unknown') {
    return [];
  }
  const trimmed = camelotKey.trim().toUpperCase();
  const match = trimmed.match(CAMELOT_KEY_PATTERN);
  if (!match) {
    return [trimmed];
  }
  const num = Number.parseInt(match[1], 10);
  const letter = match[2].toUpperCase();
  if (num < 1 || num > 12 || (letter !== 'A' && letter !== 'B')) {
    return [trimmed];
  }
  const prevNum = num === 1 ? 12 : num - 1;
  const nextNum = num === 12 ? 1 : num + 1;
  const parallelLetter = letter === 'A' ? 'B' : 'A';
  const neighbors = new Set<string>([
    `${num}${letter}`,
    `${prevNum}${letter}`,
    `${nextNum}${letter}`,
    `${num}${parallelLetter}`,
  ]);
  return [...neighbors];
}
