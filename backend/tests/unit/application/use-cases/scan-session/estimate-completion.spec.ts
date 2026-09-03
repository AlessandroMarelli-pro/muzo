import { describe, expect, it } from 'vitest';
import { estimateCompletion } from 'src/application/use-cases/scan-session/estimate-completion';

const NOW = new Date('2026-01-01T00:10:00.000Z');

describe('estimateCompletion', () => {
  it('warming-up: returns null eta when fewer than 5 tracks have been processed', () => {
    const result = estimateCompletion(
      {
        startedAt: new Date(NOW.getTime() - 60_000),
        completedTracks: 2,
        failedTracks: 1,
        totalTracks: 100,
      },
      NOW,
    );

    expect(result.etaSeconds).toBeNull();
    expect(result.tracksPerSecond).toBeNull();
    expect(result.confidence).toBe('warming-up');
  });

  it('warming-up: returns null eta when not enough time has elapsed yet, even with several tracks done', () => {
    const result = estimateCompletion(
      {
        startedAt: new Date(NOW.getTime() - 2_000), // under the 10s floor
        completedTracks: 10,
        failedTracks: 0,
        totalTracks: 100,
      },
      NOW,
    );

    expect(result.etaSeconds).toBeNull();
    expect(result.confidence).toBe('warming-up');
  });

  it('zero totals: returns null eta and does not divide by zero', () => {
    const result = estimateCompletion(
      {
        startedAt: new Date(NOW.getTime() - 60_000),
        completedTracks: 0,
        failedTracks: 0,
        totalTracks: 0,
      },
      NOW,
    );

    expect(result.etaSeconds).toBeNull();
    expect(result.tracksPerSecond).toBeNull();
  });

  it('nothing left to estimate: returns null eta when processed already reached totalTracks', () => {
    const result = estimateCompletion(
      {
        startedAt: new Date(NOW.getTime() - 120_000),
        completedTracks: 98,
        failedTracks: 2,
        totalTracks: 100,
      },
      NOW,
    );

    expect(result.etaSeconds).toBeNull();
    expect(result.tracksPerSecond).toBeNull();
    expect(result.confidence).toBe('high');
  });

  it('normal mid-scan case: computes a rate and a remaining-time estimate', () => {
    // 20 tracks in 100s -> 0.2 tracks/s; 80 remaining -> 400s expected, rounded to a minute bucket.
    const result = estimateCompletion(
      {
        startedAt: new Date(NOW.getTime() - 100_000),
        completedTracks: 19,
        failedTracks: 1,
        totalTracks: 100,
      },
      NOW,
    );

    expect(result.tracksPerSecond).toBeCloseTo(0.2, 5);
    expect(result.etaSeconds).toBe(420); // 400s rounded to the nearest 60s bucket
    expect(result.confidence).toBe('medium');
    expect(result.elapsedSeconds).toBe(100);
  });

  it('rounding buckets: rounds sub-minute etas to the nearest 5s', () => {
    // 10 tracks in 20s -> 0.5 tracks/s; 15 remaining -> 30s, already a 5s multiple.
    const result = estimateCompletion(
      {
        startedAt: new Date(NOW.getTime() - 20_000),
        completedTracks: 10,
        failedTracks: 0,
        totalTracks: 25,
      },
      NOW,
    );

    expect(result.etaSeconds).toBe(30);
  });

  it('rounding buckets: rounds etas over a minute to the nearest minute', () => {
    // 10 tracks in 60s -> 1/6 tracks/s; 20 remaining -> 120s.
    const result = estimateCompletion(
      {
        startedAt: new Date(NOW.getTime() - 60_000),
        completedTracks: 10,
        failedTracks: 0,
        totalTracks: 30,
      },
      NOW,
    );

    expect(result.etaSeconds).toBe(120);
  });

  it('confidence: high once at least half the scan is processed', () => {
    const result = estimateCompletion(
      {
        startedAt: new Date(NOW.getTime() - 100_000),
        completedTracks: 50,
        failedTracks: 0,
        totalTracks: 100,
      },
      NOW,
    );

    expect(result.confidence).toBe('high');
  });

  it('confidence: low early in the scan (below the medium threshold)', () => {
    const result = estimateCompletion(
      {
        startedAt: new Date(NOW.getTime() - 100_000),
        completedTracks: 5,
        failedTracks: 0,
        totalTracks: 100,
      },
      NOW,
    );

    expect(result.confidence).toBe('low');
  });
});
