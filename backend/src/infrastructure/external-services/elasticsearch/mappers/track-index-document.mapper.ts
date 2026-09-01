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

/** Confidence floor below which an instrument label is dropped -- keeps the
 * near-universal low-confidence tail (e.g. faint "bass" on almost everything)
 * from diluting the boost. Top 5 by confidence, matching the ai-service's
 * own top_n for this classifier head. */
const INSTRUMENT_CONFIDENCE_FLOOR = 0.15;
const MAX_INDEXED_INSTRUMENTS = 5;

function selectInstruments(
  instruments: { instrument: string; confidence: number }[] | undefined,
): string[] {
  return (instruments ?? [])
    .filter((i) => i.confidence >= INSTRUMENT_CONFIDENCE_FLOOR)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, MAX_INDEXED_INSTRUMENTS)
    .map((i) => i.instrument);
}

/** Only includes the key when `value` is present -- an unanalyzed feature is
 * omitted from the document rather than indexed as a placeholder (`0`/`''`),
 * so a `gauss`/`term` function scores it as contributing nothing instead of
 * as maximally distant from every seed. */
function optionalField<K extends string, V>(key: K, value: V | undefined): { [P in K]?: V } {
  return value != null ? ({ [key]: value } as { [P in K]?: V }) : {};
}

export const toElasticsearchTrackDocument = (dto: MusicTrack): ElasticsearchTrackDocument => {
  const date = dto.metadata?.date;
  const embedding = sliceEmbeddingVector(dto.features?.embedding);
  const mf = dto.features?.musicalFeatures;
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
    instruments: selectInstruments(dto.features?.instruments),
    musical_audio_features: {
      ...optionalField('tempo', mf?.tempo),
      ...optionalField('key', mf?.key),
      ...optionalField('camelot_key', mf?.camelotKey),
      ...optionalField('valence', mf?.valence),
      ...optionalField('valence_mood', mf?.valenceMood),
      ...optionalField('arousal', mf?.arousal),
      ...optionalField('arousal_mood', mf?.arousalMood),
      ...optionalField('danceability', mf?.danceability),
      ...optionalField('danceability_feeling', mf?.danceabilityFeeling),
      ...optionalField('instrumentalness', mf?.instrumentalness),
      ...optionalField('voice', mf?.voice),
      ...optionalField('mood_happy', mf?.moodHappy),
      ...optionalField('mood_sad', mf?.moodSad),
      ...optionalField('mood_relaxed', mf?.moodRelaxed),
      ...optionalField('mood_aggressive', mf?.moodAggressive),
      ...optionalField('mood_party', mf?.moodParty),
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
      // Confidence isn't stored per-document (see selectInstruments) -- round-tripped
      // as 1 since only presence/rank, not the original score, survives indexing.
      instruments: document.instruments?.map((instrument) => ({ instrument, confidence: 1 })),
    },
  };
};
