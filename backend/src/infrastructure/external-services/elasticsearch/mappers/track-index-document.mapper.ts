import { MusicTrack } from 'src/kernel/types';
import { ElasticsearchTrackDocument } from '../types/elasticsearch-track-document';

const MFCC_DIM = 13;
const EMBEDDING_DIM = 1280;

function sliceVector(values: number[] | undefined, dim: number): number[] {
  if (!values || values.length === 0) {
    return Array(dim).fill(0);
  }
  const out = Array(dim).fill(0);
  for (let i = 0; i < dim; i += 1) {
    const v = values[i];
    out[i] = typeof v === 'number' && Number.isFinite(v) ? v : 0;
  }
  return out;
}

function sliceMfccVector(values: number[] | undefined): number[] {
  return sliceVector(values, MFCC_DIM);
}

function sliceEmbeddingVector(values: number[] | undefined): number[] | undefined {
  if (!values || values.length === 0) {
    return undefined;
  }
  return sliceVector(values, EMBEDDING_DIM);
}

function buildEnergyByBand(
  bands: number[] | undefined,
): { bass: number; mid: number; high: number } | undefined {
  if (!bands || bands.length !== 3) {
    return undefined;
  }
  const [bass, mid, high] = bands;
  if (![bass, mid, high].every((v) => typeof v === 'number' && Number.isFinite(v))) {
    return undefined;
  }
  return { bass, mid, high };
}

function buildEnergyRatios(bands: number[] | undefined): { bass: number; mid: number; high: number } | undefined {
  if (!bands || bands.length !== 3) {
    return undefined;
  }
  const total = bands[0] + bands[1] + bands[2];
  if (!(total > 0)) {
    return { bass: 0, mid: 0, high: 0 };
  }
  return {
    bass: bands[0] / total,
    mid: bands[1] / total,
    high: bands[2] / total,
  };
}

export const toElasticsearchTrackDocument = (dto: MusicTrack): ElasticsearchTrackDocument => {
  const date = dto.metadata?.date;
  const energyBands = dto.features?.musicalFeatures?.calculationFeatures?.energyByBand;
  const embedding = sliceEmbeddingVector(dto.features?.spectralFeatures?.embedding);
  const doc: ElasticsearchTrackDocument = {
    trackId: dto.id,
    duration: dto.technicalInfo?.duration ?? 0,
    title: dto.title ?? '',
    artist: dto.artist ?? '',
    album: dto.metadata?.album ?? '',
    year: date?.getFullYear() ?? 0,
    ...(date && { date: date.toISOString() }),
    genres: dto.metadata?.genres ?? [],
    subgenres: dto.metadata?.subgenres ?? [],
    tags: dto.aiMetadata?.tags ?? [],
    vocals_desc: dto.aiMetadata?.vocalsDesc ?? '',
    atmosphere_tags: dto.aiMetadata?.atmosphereTags ?? [],
    context_background: dto.aiMetadata?.contextBackground ?? '',
    context_impact: dto.aiMetadata?.contextImpact ?? '',
    chroma_dominant_pitch: dto.features?.melodicFeatures?.chroma?.dominant_pitch,
    musical_audio_features: {
      tempo: dto.features?.musicalFeatures?.tempo ?? 0,
      key: dto.features?.musicalFeatures?.key ?? '',
      camelot_key: dto.features?.musicalFeatures?.camelotKey ?? '',
      energy: dto.features?.musicalFeatures?.energy ?? 0,
      valence: dto.features?.musicalFeatures?.valence ?? 0,
      valence_mood: dto.features?.musicalFeatures?.valenceMood ?? '',
      arousal: dto.features?.musicalFeatures?.arousal ?? 0,
      arousal_mood: dto.features?.musicalFeatures?.arousalMood ?? '',
      danceability: dto.features?.musicalFeatures?.danceability ?? 0,
      danceability_feeling: dto.features?.musicalFeatures?.danceabilityFeeling ?? '',
    },
    spectral_features: {
      spectral_centroid: dto.features?.spectralFeatures?.spectralCentroid,
      spectral_rolloff: dto.features?.spectralFeatures?.spectralRolloff,
      spectral_spread: dto.features?.spectralFeatures?.spectralSpread,
      spectral_bandwidth: dto.features?.spectralFeatures?.spectralBandwith,
      spectral_flatness: dto.features?.spectralFeatures?.spectralFlatness,
      zero_crossing_rate: dto.features?.spectralFeatures?.zeroCrossingRate,
      spectral_contrast: dto.features?.spectralFeatures?.spectralContrast,
      mfcc_mean: sliceMfccVector(dto.features?.spectralFeatures?.mfcc),
      mfcc_std: sliceMfccVector(dto.features?.spectralFeatures?.mfccStd),
      ...(embedding && { discogs_embedding: embedding }),
      onset_density: dto.features?.spectralFeatures?.onsetDensity,
      dynamic_range: dto.features?.spectralFeatures?.dynamicRange,
      bass_presence: dto.features?.musicalFeatures?.calculationFeatures?.bassPresence,
      energy_by_band: buildEnergyByBand(energyBands),
      energy_ratios: buildEnergyRatios(energyBands),
    },
  };
  return doc;
};

export const toMusicTrack = (
  document: ElasticsearchTrackDocument,
): Omit<
  MusicTrack,
  | 'createdAt'
  | 'updatedAt'
  | 'createdById'
  | 'updatedById'
  | 'libraryId'
  | 'stats'
  | 'fileInfo'
  | 'technicalInfo'
  | 'analysisInfo'
> => {
  return {
    id: document.trackId,
    title: document.title,
    artist: document.artist,
    metadata: {
      album: document.album,
      date: document.date ? new Date(document.date) : undefined,
      genres: document.genres,
      subgenres: document.subgenres,
      duration: document.duration,
    },
    aiMetadata: {
      tags: document.tags,
      vocalsDesc: document.vocals_desc,
      atmosphereTags: document.atmosphere_tags,
      contextBackground: document.context_background,
      contextImpact: document.context_impact,
      description: '',
    },
    features: {
      musicalFeatures: {
        tempo: document.musical_audio_features.tempo,
        key: document.musical_audio_features.key,
        camelotKey: document.musical_audio_features.camelot_key,
        energy: document.musical_audio_features.energy,
        valence: document.musical_audio_features.valence,
        valenceMood: document.musical_audio_features.valence_mood,
        arousal: document.musical_audio_features.arousal,
        arousalMood: document.musical_audio_features.arousal_mood,
        danceability: document.musical_audio_features.danceability,
        danceabilityFeeling: document.musical_audio_features.danceability_feeling,
      },
      spectralFeatures: undefined,
      melodicFeatures: undefined,
      fingerprint: undefined,
    },
  };
};
