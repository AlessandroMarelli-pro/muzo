import { AudioFeatures } from 'src/application/ports/dtos/AudioFeatures';
import { MusicTrack } from 'src/kernel/types';

export const toAudioFeatures = (track: MusicTrack): AudioFeatures => {
  return {
    trackId: track.id,
    tempo: track.features?.musicalFeatures?.tempo ?? 0,
    key: track.features?.musicalFeatures?.key ?? '',
    camelotKey: track.features?.musicalFeatures?.camelotKey ?? '',
    energy: track.features?.musicalFeatures?.energy ?? 0,
    valence: track.features?.musicalFeatures?.valence ?? 0,
    valenceMood: track.features?.musicalFeatures?.valenceMood ?? '',
    arousal: track.features?.musicalFeatures?.arousal ?? 0,
    arousalMood: track.features?.musicalFeatures?.arousalMood ?? '',
    danceability: track.features?.musicalFeatures?.danceability ?? 0,
    danceabilityFeeling:
      track.features?.musicalFeatures?.danceabilityFeeling ?? '',
    genres: track.metadata?.genres ?? [],
    subgenres: track.metadata?.subgenres ?? [],
    artist: track.artist,
    album: track.metadata?.album ?? '',
    aiDescriptions: [track.aiMetadata?.description ?? ''],
    aiTags: track.aiMetadata?.tags ?? [],
    vocalsDescriptions: track.aiMetadata?.vocalsDesc ?? '',
    atmosphereKeywords: track.aiMetadata?.atmosphereTags ?? [],
    contextBackgrounds: track.aiMetadata?.contextBackground ?? '',
    contextImpacts: track.aiMetadata?.contextImpact ?? '',
  };
};
