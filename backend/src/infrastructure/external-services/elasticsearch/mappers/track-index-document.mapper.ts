import { MusicTrack } from 'src/kernel/types';
import { ElasticsearchTrackDocument } from '../types/elasticsearch-track-document';

export const toElasticsearchTrackDocument = (
  dto: MusicTrack,
): ElasticsearchTrackDocument => {
  const date = dto.metadata?.date;
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
    atmosphere_desc: dto.aiMetadata?.atmosphereDesc ?? [],
    context_background: dto.aiMetadata?.contextBackground ?? '',
    context_impact: dto.aiMetadata?.contextImpact ?? '',
    musical_audio_features: {
      tempo: dto.features?.musicalFeatures?.tempo ?? 0,
      key: dto.features?.musicalFeatures?.key ?? '',
      camelot_key: dto.features?.musicalFeatures?.camelotKey ?? '',
      valence: dto.features?.musicalFeatures?.valence ?? 0,
      valence_mood: dto.features?.musicalFeatures?.valenceMood ?? '',
      arousal: dto.features?.musicalFeatures?.arousal ?? 0,
      arousal_mood: dto.features?.musicalFeatures?.arousalMood ?? '',
      danceability: dto.features?.musicalFeatures?.danceability ?? 0,
      danceability_feeling:
        dto.features?.musicalFeatures?.danceabilityFeeling ?? '',
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
      atmosphereDesc: document.atmosphere_desc,
      contextBackground: document.context_background,
      contextImpact: document.context_impact,
      description: '',
    },
    features: {
      musicalFeatures: {
        tempo: document.musical_audio_features.tempo,
        key: document.musical_audio_features.key,
        camelotKey: document.musical_audio_features.camelot_key,
        valence: document.musical_audio_features.valence,
        valenceMood: document.musical_audio_features.valence_mood,
        arousal: document.musical_audio_features.arousal,
        arousalMood: document.musical_audio_features.arousal_mood,
        danceability: document.musical_audio_features.danceability,
        danceabilityFeeling:
          document.musical_audio_features.danceability_feeling,
      },
      spectralFeatures: undefined,
      melodicFeatures: undefined,
      fingerprint: undefined,
    },
  };
};
