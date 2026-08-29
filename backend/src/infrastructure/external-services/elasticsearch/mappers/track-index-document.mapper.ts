import { MusicTrack } from 'src/kernel/types';
import { ElasticsearchTrackDocument } from '../types/elasticsearch-track-document';

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

/** A zero-magnitude vector makes Elasticsearch's cosine similarity undefined --
 * indexing one throws and fails the whole bulk request, not just that document. */
function isZeroVector(vector: number[]): boolean {
  return vector.every((v) => v === 0);
}

function sliceEmbeddingVector(values: number[] | undefined): number[] | undefined {
  if (!values || values.length === 0) {
    return undefined;
  }
  const vector = sliceVector(values, EMBEDDING_DIM);
  return isZeroVector(vector) ? undefined : vector;
}

export const toElasticsearchTrackDocument = (dto: MusicTrack): ElasticsearchTrackDocument => {
  const date = dto.metadata?.date;
  const embedding = sliceEmbeddingVector(dto.features?.embedding);
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
    musical_audio_features: {
      tempo: dto.features?.musicalFeatures?.tempo ?? 0,
      key: dto.features?.musicalFeatures?.key ?? '',
      camelot_key: dto.features?.musicalFeatures?.camelotKey ?? '',
      valence: dto.features?.musicalFeatures?.valence ?? 0,
      valence_mood: dto.features?.musicalFeatures?.valenceMood ?? '',
      arousal: dto.features?.musicalFeatures?.arousal ?? 0,
      arousal_mood: dto.features?.musicalFeatures?.arousalMood ?? '',
      danceability: dto.features?.musicalFeatures?.danceability ?? 0,
      danceability_feeling: dto.features?.musicalFeatures?.danceabilityFeeling ?? '',
      instrumentalness: dto.features?.musicalFeatures?.instrumentalness ?? 0,
      voice: dto.features?.musicalFeatures?.voice ?? 0,
      mood_happy: dto.features?.musicalFeatures?.moodHappy ?? 0,
      mood_sad: dto.features?.musicalFeatures?.moodSad ?? 0,
      mood_relaxed: dto.features?.musicalFeatures?.moodRelaxed ?? 0,
      mood_aggressive: dto.features?.musicalFeatures?.moodAggressive ?? 0,
      mood_party: dto.features?.musicalFeatures?.moodParty ?? 0,
    },
    audio_features: {
      ...(embedding && { discogs_embedding: embedding }),
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
        danceabilityFeeling: document.musical_audio_features.danceability_feeling,
        instrumentalness: document.musical_audio_features.instrumentalness,
        voice: document.musical_audio_features.voice,
        moodHappy: document.musical_audio_features.mood_happy,
        moodSad: document.musical_audio_features.mood_sad,
        moodRelaxed: document.musical_audio_features.mood_relaxed,
        moodAggressive: document.musical_audio_features.mood_aggressive,
        moodParty: document.musical_audio_features.mood_party,
      },
      embedding: document.audio_features.discogs_embedding,
    },
  };
};
