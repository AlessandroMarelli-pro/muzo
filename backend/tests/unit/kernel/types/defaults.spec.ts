import { describe, expect, it } from 'vitest';

import {
  applyRecommendationBoosts,
  DEFAULT_RECOMMENDATION_WEIGHTS,
} from 'src/kernel/types/defaults';

describe('applyRecommendationBoosts', () => {
  it('returns the plain defaults when no boosts are selected', () => {
    expect(applyRecommendationBoosts(undefined)).toEqual(DEFAULT_RECOMMENDATION_WEIGHTS);
    expect(applyRecommendationBoosts([])).toEqual(DEFAULT_RECOMMENDATION_WEIGHTS);
  });

  it('multiplies only the selected criterion, leaving everything else at default', () => {
    const weights = applyRecommendationBoosts(['arousalSimilarity']);
    expect(weights.arousalSimilarity).toBeGreaterThan(DEFAULT_RECOMMENDATION_WEIGHTS.arousalSimilarity);
    expect(weights.danceabilitySimilarity).toBe(DEFAULT_RECOMMENDATION_WEIGHTS.danceabilitySimilarity);
    expect(weights.moodSimilarity).toBe(DEFAULT_RECOMMENDATION_WEIGHTS.moodSimilarity);
  });

  it('boosting multiple criteria at once keeps the total under the embedding base (1.0)', () => {
    const weights = applyRecommendationBoosts([
      'genreSimilarity',
      'audioFeatures',
      'moodSimilarity',
      'arousalSimilarity',
      'danceabilitySimilarity',
      'instrumentalnessSimilarity',
      'voiceSimilarity',
      'instrumentsSimilarity',
    ]);
    const total =
      weights.genreSimilarity +
      weights.audioFeatures +
      weights.moodSimilarity +
      weights.arousalSimilarity +
      weights.danceabilitySimilarity +
      weights.instrumentalnessSimilarity +
      weights.voiceSimilarity +
      weights.instrumentsSimilarity;
    expect(total).toBeLessThanOrEqual(0.7 + 1e-9);
  });

  it('preserves relative ratios between boosted criteria when scaled down by the ceiling', () => {
    const weights = applyRecommendationBoosts(['moodSimilarity', 'genreSimilarity']);
    const expectedRatio =
      DEFAULT_RECOMMENDATION_WEIGHTS.moodSimilarity / DEFAULT_RECOMMENDATION_WEIGHTS.genreSimilarity;
    expect(weights.moodSimilarity / weights.genreSimilarity).toBeCloseTo(expectedRatio);
  });

  it('ignores unknown or dead keys (audioSimilarity/metadataSimilarity/userBehavior are never scored)', () => {
    const weights = applyRecommendationBoosts(['audioSimilarity', 'not-a-real-key']);
    expect(weights).toEqual(DEFAULT_RECOMMENDATION_WEIGHTS);
  });
});
