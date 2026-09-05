import { camelotDistance } from 'src/kernel/utils/camelot-distance';
import { describe, expect, it } from 'vitest';

describe('camelotDistance', () => {
  it('is 0 for identical keys', () => {
    expect(camelotDistance('8A', '8A')).toBe(0);
  });

  it('is 1 for adjacent clock steps on the same ring', () => {
    expect(camelotDistance('8A', '9A')).toBe(1);
    expect(camelotDistance('8A', '7A')).toBe(1);
  });

  it('is 1 for the relative major/minor', () => {
    expect(camelotDistance('8A', '8B')).toBe(1);
  });

  it('wraps around the 12-position clock', () => {
    expect(camelotDistance('1A', '12A')).toBe(1);
  });

  it('adds a ring-switch penalty for distant, different-letter keys', () => {
    expect(camelotDistance('8A', '3B')).toBe(6);
  });

  it('returns null for unparseable keys', () => {
    expect(camelotDistance(null, '8A')).toBeNull();
    expect(camelotDistance('8A', 'not-a-key')).toBeNull();
  });
});
