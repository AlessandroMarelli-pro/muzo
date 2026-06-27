import { describe, expect, it } from 'vitest';
import { getCamelotNeighbors } from 'src/infrastructure/external-services/elasticsearch/builders/camelot-neighbors';

describe('getCamelotNeighbors', () => {
  it('returns same, +/-1 number, and parallel letter for 8B', () => {
    const neighbors = getCamelotNeighbors('8B');
    expect(neighbors.sort()).toEqual(['7B', '8A', '8B', '9B'].sort());
  });

  it('wraps 12 to 1 and 1 to 12', () => {
    expect(getCamelotNeighbors('12A').sort()).toEqual(['11A', '12A', '12B', '1A'].sort());
    expect(getCamelotNeighbors('1B').sort()).toEqual(['1A', '1B', '12B', '2B'].sort());
  });

  it('returns empty for blank or unknown', () => {
    expect(getCamelotNeighbors('')).toEqual([]);
    expect(getCamelotNeighbors(undefined)).toEqual([]);
    expect(getCamelotNeighbors('Unknown')).toEqual([]);
  });
});
