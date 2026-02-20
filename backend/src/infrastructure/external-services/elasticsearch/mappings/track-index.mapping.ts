import {
  MappingProperty,
  MappingTypeMapping,
} from '@elastic/elasticsearch/lib/api/types';
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
      tags: { type: 'keyword' },
      vocals_desc: { type: 'text' },
      atmosphere_tags: { type: 'keyword' },
      context_background: { type: 'text' },
      context_impact: { type: 'text' },
      // AudioFingerprint fields
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
        } as Record<
          keyof ElasticsearchTrackDocument['musical_audio_features'],
          MappingProperty
        >,
      },
    } as Record<keyof ElasticsearchTrackDocument, MappingProperty>,
  },
};
