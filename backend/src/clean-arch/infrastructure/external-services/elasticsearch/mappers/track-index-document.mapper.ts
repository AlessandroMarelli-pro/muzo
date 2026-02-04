import { TrackIndexDocument } from 'src/clean-arch/application/ports/dtos/TrackIndexDocument';
import { ElasticsearchTrackDocument } from '../types/elasticsearch-track-document';

export const toElasticsearchTrackDocument = (
  dto: TrackIndexDocument,
): ElasticsearchTrackDocument => {
  return {
    trackId: dto.trackId,
    duration: dto.duration,
    title: dto.title,
    artist: dto.artist,
    album: dto.album,
    year: dto.year,
    date: dto.date,
    genres: dto.genres,
    subgenres: dto.subgenres,
    tags: dto.tags,
    vocals_desc: dto.vocalsDesc,
    atmosphere_desc: dto.atmosphereDesc,
    context_background: dto.contextBackground,
    context_impact: dto.contextImpact,
    musical_audio_features: {
      tempo: dto.tempo,
      key: dto.key,
      camelot_key: dto.camelotKey,
      valence: dto.valence,
      valence_mood: dto.valenceMood,
      arousal: dto.arousal,
      arousal_mood: dto.arousalMood,
      danceability: dto.danceability,
      danceability_feeling: dto.danceabilityFeeling,
    },
  };
};

export const toTrackIndexDocument = (
  document: ElasticsearchTrackDocument,
): TrackIndexDocument => {
  return {
    trackId: document.trackId,
    duration: document.duration,
    title: document.title,
    artist: document.artist,
    album: document.album,
    year: document.year,
    date: document.date,
    genres: document.genres,
    subgenres: document.subgenres,
    tags: document.tags,
    vocalsDesc: document.vocals_desc,
    atmosphereDesc: document.atmosphere_desc,
    contextBackground: document.context_background,
    contextImpact: document.context_impact,
    tempo: document.musical_audio_features.tempo,
    key: document.musical_audio_features.key,
    camelotKey: document.musical_audio_features.camelot_key,
    valence: document.musical_audio_features.valence,
    valenceMood: document.musical_audio_features.valence_mood,
    arousal: document.musical_audio_features.arousal,
    arousalMood: document.musical_audio_features.arousal_mood,
    danceability: document.musical_audio_features.danceability,
    danceabilityFeeling: document.musical_audio_features.danceability_feeling,
  };
};
