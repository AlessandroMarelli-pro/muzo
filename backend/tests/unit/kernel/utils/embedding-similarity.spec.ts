import { cosineDistance } from 'src/kernel/utils/embedding-similarity';
import { describe, expect, it } from 'vitest';

describe('cosineDistance', () => {
  it('is 0 for identical vectors', () => {
    expect(cosineDistance([1, 0, 0], [1, 0, 0])).toBeCloseTo(0, 10);
  });

  it('is 1 for orthogonal vectors', () => {
    expect(cosineDistance([1, 0], [0, 1])).toBeCloseTo(1, 10);
  });

  it('is 2 for opposite vectors', () => {
    expect(cosineDistance([1, 0], [-1, 0])).toBeCloseTo(2, 10);
  });

  it('returns null for missing, empty, or mismatched-length vectors', () => {
    expect(cosineDistance(undefined, [1, 0])).toBeNull();
    expect(cosineDistance([], [1, 0])).toBeNull();
    expect(cosineDistance([1, 0, 0], [1, 0])).toBeNull();
  });

  it('returns null for zero-magnitude vectors', () => {
    expect(cosineDistance([0, 0], [1, 0])).toBeNull();
  });
});
