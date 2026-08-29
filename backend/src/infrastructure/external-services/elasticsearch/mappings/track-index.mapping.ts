import { MappingProperty, MappingTypeMapping } from '@elastic/elasticsearch/lib/api/types';
import { ElasticsearchTrackDocument } from '../types/elasticsearch-track-document';

export const trackIndexMapping: {
  mappings: MappingTypeMapping;
} = {
  mappings: {
    properties: {
      trackId: { type: 'keyword' },
      duration: { type: 'float' },
      title: { type: 'text' },
      artist: { type: 'text' },
      album: { type: 'text' },
      year: { type: 'integer' },
      date: { type: 'date' },
      genres: { type: 'keyword' },
      subgenres: { type: 'keyword' },
      musical_audio_features: {
        properties: {
          tempo: { type: 'float' },
          key: { type: 'keyword' },
          camelot_key: { type: 'keyword' },
          valence: { type: 'float' },
          valence_mood: { type: 'keyword' },
          arousal: { type: 'float' },
          arousal_mood: { type: 'keyword' },
          danceability: { type: 'float' },
          danceability_feeling: { type: 'keyword' },
          instrumentalness: { type: 'float' },
          voice: { type: 'float' },
          mood_happy: { type: 'float' },
          mood_sad: { type: 'float' },
          mood_relaxed: { type: 'float' },
          mood_aggressive: { type: 'float' },
          mood_party: { type: 'float' },
        } as Record<keyof ElasticsearchTrackDocument['musical_audio_features'], MappingProperty>,
      },
      audio_features: {
        properties: {
          /** 1280-dim discogs-effnet embedding (Essentia) for acoustic similarity search. */
          discogs_embedding: {
            type: 'dense_vector',
            dims: 1280,
            index: true,
            similarity: 'cosine',
          },
        } as Record<keyof ElasticsearchTrackDocument['audio_features'], MappingProperty>,
      },
    } as Record<keyof ElasticsearchTrackDocument, MappingProperty>,
  },
};
