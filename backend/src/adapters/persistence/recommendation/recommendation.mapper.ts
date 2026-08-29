import { AudioFeatures } from 'src/application/ports/dtos/AudioFeatures';
import { MusicTrack } from 'src/kernel/types';

export const toAudioFeatures = (track: MusicTrack): AudioFeatures => {
  return {
    trackId: track.id,
    tempo: {
      min: track.features?.musicalFeatures?.tempo ?? 0,
      max: track.features?.musicalFeatures?.tempo ?? 0,
    },
    key: track.features?.musicalFeatures?.key ?? '',
    camelotKey: track.features?.musicalFeatures?.camelotKey ?? '',
    valence: track.features?.musicalFeatures?.valence ?? 0,
    valenceMood: track.features?.musicalFeatures?.valenceMood ?? '',
    arousal: track.features?.musicalFeatures?.arousal ?? 0,
    arousalMood: track.features?.musicalFeatures?.arousalMood ?? '',
    danceability: track.features?.musicalFeatures?.danceability ?? 0,
    danceabilityFeeling: track.features?.musicalFeatures?.danceabilityFeeling ?? '',
    instrumentalness: track.features?.musicalFeatures?.instrumentalness ?? 0,
    voice: track.features?.musicalFeatures?.voice ?? 0,
    moodHappy: track.features?.musicalFeatures?.moodHappy ?? 0,
    moodSad: track.features?.musicalFeatures?.moodSad ?? 0,
    moodRelaxed: track.features?.musicalFeatures?.moodRelaxed ?? 0,
    moodAggressive: track.features?.musicalFeatures?.moodAggressive ?? 0,
    moodParty: track.features?.musicalFeatures?.moodParty ?? 0,
    embedding: track.features?.embedding,
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
