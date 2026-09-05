/**
 * Camelot wheel distance — ported from frontend/src/lib/camelot.ts, kept
 * numerically identical. A key is a clock position 1-12 plus a letter:
 * `A` = minor (outer ring), `B` = major (inner ring). Tracks mix
 * harmonically when their keys are the same, one clock step apart on the
 * same ring, or the relative major/minor (same number, other letter).
 */

interface CamelotKey {
  code: string;
  number: number;
  letter: 'A' | 'B';
}

function build(): CamelotKey[] {
  const keys: CamelotKey[] = [];
  for (let number = 1; number <= 12; number++) {
    keys.push({ code: `${number}A`, number, letter: 'A' });
    keys.push({ code: `${number}B`, number, letter: 'B' });
  }
  return keys;
}

const CAMELOT_KEYS = build();
const BY_CODE = new Map(CAMELOT_KEYS.map((k) => [k.code, k]));

/** Normalise a raw code ("8a", " 8A ") to canonical form, or null. */
function normalizeCamelot(raw?: string | null): string | null {
  if (!raw) return null;
  const match = raw.trim().toUpperCase().match(/^(\d{1,2})([AB])$/);
  if (!match) return null;
  const number = Number(match[1]);
  if (number < 1 || number > 12) return null;
  return `${number}${match[2]}`;
}

function getCamelotKey(code?: string | null): CamelotKey | undefined {
  const normalized = normalizeCamelot(code);
  return normalized ? BY_CODE.get(normalized) : undefined;
}

const wrap = (n: number): number => ((n - 1 + 12) % 12) + 1;

/**
 * The keys that mix harmonically with `code`, including `code` itself: same
 * key, ±1 clock step on the same ring, and the relative major/minor.
 */
function getCompatibleKeys(code?: string | null): string[] {
  const key = getCamelotKey(code);
  if (!key) return [];
  const { number, letter } = key;
  const other = letter === 'A' ? 'B' : 'A';
  return [
    `${number}${letter}`,
    `${wrap(number - 1)}${letter}`,
    `${wrap(number + 1)}${letter}`,
    `${number}${other}`,
  ];
}

/**
 * Wheel distance between two Camelot keys, for scoring — not just a yes/no
 * harmonic check. 0 = identical key. 1 = compatible (±1 step on the same
 * ring, or the relative major/minor). Otherwise the shorter ring distance
 * plus a switch-ring penalty when the letters differ. Unknown/unparseable
 * keys return `null`.
 */
export function camelotDistance(a?: string | null, b?: string | null): number | null {
  const x = getCamelotKey(a);
  const y = getCamelotKey(b);
  if (!x || !y) return null;
  if (x.code === y.code) return 0;
  if (getCompatibleKeys(x.code).includes(y.code)) return 1;
  const ringDelta = Math.min(Math.abs(x.number - y.number), 12 - Math.abs(x.number - y.number));
  const ringSwitchPenalty = x.letter === y.letter ? 0 : 1;
  return ringDelta + ringSwitchPenalty;
}
