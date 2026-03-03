import {
  MappingProperty,
  MappingTypeMapping,
} from '@elastic/elasticsearch/lib/api/types';
import { ElasticsearchTrackDocument } from '../types/elasticsearch-track-document';

const aggregationStatisticsMapping: MappingProperty = {
  properties: {
    mean: { type: 'float' },
    std: { type: 'float' },
    max: { type: 'float' },
    p25: { type: 'float' },
    p75: { type: 'float' },
    median: { type: 'float' },
    min: { type: 'float' },
  },
};
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
      spectral_features: {
        properties: {
          spectral_centroid: aggregationStatisticsMapping,
          spectral_rolloff: aggregationStatisticsMapping,
          spectral_spread: aggregationStatisticsMapping,
          spectral_bandwidth: aggregationStatisticsMapping,
          spectral_flatness: aggregationStatisticsMapping,
          zero_crossing_rate: aggregationStatisticsMapping,
          mfcc_mean: { type: 'keyword' },
        } as Record<
          keyof ElasticsearchTrackDocument['spectral_features'],
          MappingProperty
        >,
      },
    } as Record<keyof ElasticsearchTrackDocument, MappingProperty>,
  },
};
