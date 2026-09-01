/**
 * Camelot wheel — the harmonic-mixing coordinate system DJs use.
 *
 * A key is a clock position 1–12 plus a letter: `A` = minor (outer ring),
 * `B` = major (inner ring). Tracks mix harmonically when their keys are the
 * same, one clock step apart on the same ring, or the relative major/minor
 * (same number, other letter).
 */

export interface CamelotKey {
  /** e.g. "8A" */
  code: string;
  /** clock position, 1–12 */
  number: number;
  /** 'A' = minor, 'B' = major */
  letter: 'A' | 'B';
  /** musical key name, e.g. "A minor" */
  name: string;
  /** traditional harmonic-mixing hue for this position (opaque-ish rgba) */
  color: string;
}

/** Hue per clock position — the conventional Camelot colour, shared by A and B. */
const POSITION_COLORS: Record<number, string> = {
  1: 'rgba(0, 255, 255, 0.55)', // cyan
  2: 'rgba(120, 220, 150, 0.55)', // light green
  3: 'rgba(60, 170, 90, 0.55)', // green
  4: 'rgba(210, 190, 70, 0.55)', // gold
  5: 'rgba(230, 150, 60, 0.55)', // orange
  6: 'rgba(230, 90, 60, 0.55)', // orange red
  7: 'rgba(230, 80, 140, 0.55)', // pink
  8: 'rgba(200, 150, 210, 0.55)', // plum
  9: 'rgba(150, 90, 200, 0.55)', // purple
  10: 'rgba(70, 90, 200, 0.55)', // indigo
  11: 'rgba(70, 130, 220, 0.55)', // blue
  12: 'rgba(60, 170, 190, 0.55)', // teal
};

const MINOR_NAMES: Record<number, string> = {
  1: 'A♭ minor',
  2: 'E♭ minor',
  3: 'B♭ minor',
  4: 'F minor',
  5: 'C minor',
  6: 'G minor',
  7: 'D minor',
  8: 'A minor',
  9: 'E minor',
  10: 'B minor',
  11: 'F♯ minor',
  12: 'D♭ minor',
};

const MAJOR_NAMES: Record<number, string> = {
  1: 'B major',
  2: 'F♯ major',
  3: 'D♭ major',
  4: 'A♭ major',
  5: 'E♭ major',
  6: 'B♭ major',
  7: 'F major',
  8: 'C major',
  9: 'G major',
  10: 'D major',
  11: 'A major',
  12: 'E major',
};

function build(): CamelotKey[] {
  const keys: CamelotKey[] = [];
  for (let number = 1; number <= 12; number++) {
    keys.push({
      code: `${number}A`,
      number,
      letter: 'A',
      name: MINOR_NAMES[number],
      color: POSITION_COLORS[number],
    });
    keys.push({
      code: `${number}B`,
      number,
      letter: 'B',
      name: MAJOR_NAMES[number],
      color: POSITION_COLORS[number],
    });
  }
  return keys;
}

export const CAMELOT_KEYS: CamelotKey[] = build();

const BY_CODE = new Map(CAMELOT_KEYS.map((k) => [k.code, k]));

/** Normalise a raw code ("8a", " 8A ") to canonical form, or null. */
export function normalizeCamelot(raw?: string | null): string | null {
  if (!raw) return null;
  const match = raw.trim().toUpperCase().match(/^(\d{1,2})([AB])$/);
  if (!match) return null;
  const number = Number(match[1]);
  if (number < 1 || number > 12) return null;
  return `${number}${match[2]}`;
}

export function getCamelotKey(code?: string | null): CamelotKey | undefined {
  const normalized = normalizeCamelot(code);
  return normalized ? BY_CODE.get(normalized) : undefined;
}

const wrap = (n: number): number => ((n - 1 + 12) % 12) + 1;

/**
 * The keys that mix harmonically with `code`, including `code` itself:
 * same key, ±1 clock step on the same ring, and the relative major/minor.
 * Returns canonical codes; empty if `code` is unrecognised.
 */
export function getCompatibleKeys(code?: string | null): string[] {
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
