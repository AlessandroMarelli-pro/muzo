import { MappingProperty, MappingTypeMapping } from '@elastic/elasticsearch/lib/api/types';
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

const energyBandMapping: MappingProperty = {
  properties: {
    bass: { type: 'float' },
    mid: { type: 'float' },
    high: { type: 'float' },
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
      chroma_dominant_pitch: { type: 'integer' },
      musical_audio_features: {
        properties: {
          tempo: { type: 'float' },
          key: { type: 'keyword' },
          camelot_key: { type: 'keyword' },
          energy: { type: 'float' },
          valence: { type: 'float' },
          valence_mood: { type: 'keyword' },
          arousal: { type: 'float' },
          arousal_mood: { type: 'keyword' },
          danceability: { type: 'float' },
          danceability_feeling: { type: 'keyword' },
        } as Record<keyof ElasticsearchTrackDocument['musical_audio_features'], MappingProperty>,
      },
      spectral_features: {
        properties: {
          spectral_centroid: aggregationStatisticsMapping,
          spectral_rolloff: aggregationStatisticsMapping,
          spectral_spread: aggregationStatisticsMapping,
          spectral_bandwidth: aggregationStatisticsMapping,
          spectral_flatness: aggregationStatisticsMapping,
          zero_crossing_rate: aggregationStatisticsMapping,
          spectral_contrast: aggregationStatisticsMapping,
          mfcc_mean: {
            type: 'dense_vector',
            dims: 13,
            index: true,
            similarity: 'cosine',
          },
          mfcc_std: {
            type: 'dense_vector',
            dims: 13,
            index: false,
          },
          onset_density: { type: 'float' },
          dynamic_range: { type: 'float' },
          bass_presence: { type: 'float' },
          energy_by_band: energyBandMapping,
          energy_ratios: energyBandMapping,
        } as Record<keyof ElasticsearchTrackDocument['spectral_features'], MappingProperty>,
      },
    } as Record<keyof ElasticsearchTrackDocument, MappingProperty>,
  },
};
