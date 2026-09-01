import { describe, expect, it } from 'vitest';
import {
  CAMELOT_KEYS,
  getCamelotKey,
  getCompatibleKeys,
  normalizeCamelot,
} from '@/lib/camelot';

describe('camelot wheel data', () => {
  it('has all 24 keys, 12 minor + 12 major', () => {
    expect(CAMELOT_KEYS).toHaveLength(24);
    expect(CAMELOT_KEYS.filter((k) => k.letter === 'A')).toHaveLength(12);
    expect(CAMELOT_KEYS.filter((k) => k.letter === 'B')).toHaveLength(12);
  });

  it('codes are unique and canonical', () => {
    const codes = CAMELOT_KEYS.map((k) => k.code);
    expect(new Set(codes).size).toBe(24);
    expect(codes).toContain('8A');
    expect(codes).toContain('12B');
  });
});

describe('normalizeCamelot', () => {
  it('accepts messy input', () => {
    expect(normalizeCamelot(' 8a ')).toBe('8A');
    expect(normalizeCamelot('12B')).toBe('12B');
  });

  it('rejects nonsense', () => {
    expect(normalizeCamelot(undefined)).toBeNull();
    expect(normalizeCamelot('')).toBeNull();
    expect(normalizeCamelot('13A')).toBeNull();
    expect(normalizeCamelot('0B')).toBeNull();
    expect(normalizeCamelot('A minor')).toBeNull();
  });
});

describe('getCamelotKey', () => {
  it('resolves by code', () => {
    expect(getCamelotKey('8A')?.name).toBe('A minor');
    expect(getCamelotKey('8B')?.name).toBe('C major');
  });

  it('returns undefined for unknown', () => {
    expect(getCamelotKey('99Z')).toBeUndefined();
  });
});

describe('getCompatibleKeys', () => {
  it('returns self, ±1 on the ring, and the relative key', () => {
    expect(getCompatibleKeys('8A').sort()).toEqual(['7A', '8A', '8B', '9A'].sort());
  });

  it('wraps around the clock', () => {
    expect(getCompatibleKeys('1A').sort()).toEqual(['12A', '1A', '1B', '2A'].sort());
    expect(getCompatibleKeys('12B').sort()).toEqual(['11B', '12A', '12B', '1B'].sort());
  });

  it('is empty for an unrecognised key', () => {
    expect(getCompatibleKeys('nope')).toEqual([]);
    expect(getCompatibleKeys(null)).toEqual([]);
  });

  it('always includes the key itself', () => {
    for (const key of CAMELOT_KEYS) {
      expect(getCompatibleKeys(key.code)).toContain(key.code);
    }
  });
});
