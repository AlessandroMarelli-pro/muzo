import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const formatDuration = (seconds: number, withAllTime = false) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  let duration = '';
  if (hours > 0 || withAllTime) {
    duration += `${hours}h `;
  }
  if (minutes > 0 || withAllTime) {
    duration += `${minutes}m `;
  }
  if (remainingSeconds > 0 || withAllTime) {
    duration += `${remainingSeconds}s`;
  }
  return duration;
};

/**
 * `similarity` is the raw Elasticsearch recommendation score: an embedding
 * cosine base in [0,1] plus bounded criteria boosts, so the practical range
 * is roughly [0, 1.7] rather than a percentage. Clamped so a boosted score
 * above 1.0 still reads as "100%" instead of overflowing.
 */
export const formatSimilarity = (similarity: number) => {
  const percent = Math.max(0, Math.min(1, similarity)) * 100;
  return `${Math.round(percent)}%`;
};

export const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

/**
 * Elapsed-time label that stays readable for long durations: `h:mm` at an hour
 * or more, `m:ss` below that.
 */
export const formatElapsed = (seconds: number) => {
  const s = Math.max(0, Math.floor(seconds));
  if (s >= 3600) {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return `${h}:${m.toString().padStart(2, '0')}`;
  }
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
};

/** Coarse duration — hours and minutes only (e.g. "8h 30m", "45m"). */
export const formatCoarseDuration = (seconds: number) => {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
};

// ── Camelot / harmonic-mixing keys ───────────────────────────────────────────

export interface CamelotKey {
  n: number; // 1–12
  ab: 'A' | 'B';
}

const CAMELOT_RE = /^\s*(\d{1,2})\s*([abAB])\s*$/;

/** Parse a Camelot code ("7A", "12b"), or null if the value isn't one. */
export const parseCamelot = (code?: string | null): CamelotKey | null => {
  if (!code) return null;
  const m = code.match(CAMELOT_RE);
  if (!m) return null;
  const n = Number(m[1]);
  if (n < 1 || n > 12) return null;
  return { n, ab: m[2].toUpperCase() as 'A' | 'B' };
};

/** Normalised uppercase Camelot code ("7A") when valid, else null. */
export const toCamelotCode = (code?: string | null): string | null => {
  const k = parseCamelot(code);
  return k ? `${k.n}${k.ab}` : null;
};

/**
 * Do two keys mix harmonically? Equal, ±1 on the wheel, or relative
 * major/minor. Unknown keys return `true` — we don't flag what we can't judge.
 */
export const isHarmonicTransition = (a?: string | null, b?: string | null): boolean => {
  const x = parseCamelot(a);
  const y = parseCamelot(b);
  if (!x || !y) return true;
  if (x.n === y.n && x.ab === y.ab) return true;
  if (x.ab === y.ab) {
    const d = Math.abs(x.n - y.n);
    return d === 1 || d === 11;
  }
  return x.n === y.n;
};

export const capitalizeEveryWord = (string: string) => {
  return string
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export const encodeBase64 = (value: string) => {
  return btoa(value);
};
