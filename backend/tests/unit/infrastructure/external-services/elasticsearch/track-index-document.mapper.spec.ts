import { describe, expect, it } from 'vitest';

import { toElasticsearchTrackDocument } from 'src/infrastructure/external-services/elasticsearch/mappers/track-index-document.mapper';
import type { MusicTrack } from 'src/kernel/types';

const EMBEDDING_DIM = 1280;
const vec = (fill: number): number[] => new Array(EMBEDDING_DIM).fill(fill);

const baseTrack = (overrides?: Partial<MusicTrack['features']>): MusicTrack =>
  ({
    id: 'MusicTrack:a',
    title: 'title',
    artist: 'artist',
    metadata: { genres: [], subgenres: [] },
    features: { musicalFeatures: {}, ...overrides },
  }) as unknown as MusicTrack;

describe('toElasticsearchTrackDocument — missing scalar features', () => {
  it('omits a missing scalar/categorical field instead of coercing to 0/""', () => {
    const doc = toElasticsearchTrackDocument(
      baseTrack({ musicalFeatures: { tempo: undefined, valenceMood: undefined } }),
    );
    expect('tempo' in doc.musical_audio_features).toBe(false);
    expect('valence_mood' in doc.musical_audio_features).toBe(false);
  });

  it('keeps a present field, including a genuine 0', () => {
    const doc = toElasticsearchTrackDocument(baseTrack({ musicalFeatures: { valence: 0 } }));
    expect(doc.musical_audio_features.valence).toBe(0);
  });

  it('still omits the embedding for a zero-magnitude vector', () => {
    const doc = toElasticsearchTrackDocument(baseTrack({ embedding: vec(0) }));
    expect(doc.audio_features.discogs_embedding).toBeUndefined();
  });
});

describe('toElasticsearchTrackDocument — instruments', () => {
  it('filters below the confidence floor, sorts desc, caps at 5', () => {
    const doc = toElasticsearchTrackDocument(
      baseTrack({
        instruments: [
          { instrument: 'bass', confidence: 0.1 }, // below floor, dropped
          { instrument: 'synth', confidence: 0.9 },
          { instrument: 'drums', confidence: 0.5 },
          { instrument: 'guitar', confidence: 0.4 },
          { instrument: 'piano', confidence: 0.3 },
          { instrument: 'sax', confidence: 0.2 },
          { instrument: 'flute', confidence: 0.15 },
        ],
      }),
    );
    expect(doc.instruments).toEqual(['synth', 'drums', 'guitar', 'piano', 'sax']);
  });

  it('is an empty array when the track has no instruments', () => {
    const doc = toElasticsearchTrackDocument(baseTrack());
    expect(doc.instruments).toEqual([]);
  });
});
