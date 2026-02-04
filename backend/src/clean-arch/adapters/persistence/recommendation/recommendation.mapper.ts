import { AudioFeatures } from 'src/clean-arch/application/ports/dtos/AudioFeatures';
import { TrackIndexDocument } from 'src/clean-arch/application/ports/dtos/TrackIndexDocument';
import { MusicTrack } from 'src/clean-arch/kernel/types';

export const toAudioFeatures = (track: MusicTrack): Required<AudioFeatures> => {
  return {
    trackId: track.id,
    tempo: track.features.musicalFeatures.tempo,
    key: track.features.musicalFeatures.key,
    camelotKey: track.features.musicalFeatures.camelotKey,
    energy: track.features.musicalFeatures.energy,
    valence: track.features.musicalFeatures.valence,
    valenceMood: track.features.musicalFeatures.valenceMood,
    arousal: track.features.musicalFeatures.arousal,
    arousalMood: track.features.musicalFeatures.arousalMood,
    danceability: track.features.musicalFeatures.danceability,
    danceabilityFeeling: track.features.musicalFeatures.danceabilityFeeling,
    genres: track.metadata.genres,
    subgenres: track.metadata.subgenres,
    artist: track.artist,
    album: track.metadata.album,
    aiDescriptions: [track.aiMetadata.description],
    aiTags: track.aiMetadata.tags,
    vocalsDescriptions: track.aiMetadata.vocalsDesc,
    atmosphereKeywords: track.aiMetadata.atmosphereDesc,
    contextBackgrounds: track.aiMetadata.contextBackground,
    contextImpacts: track.aiMetadata.contextImpact,
  };
};

export const toTrackIndexDocument = (track: MusicTrack): TrackIndexDocument => {
  return {
    trackId: track.id,
    duration: track.technicalInfo.duration,
    title: track.title,
    artist: track.artist,
    album: track.metadata.album,
    year: track.metadata.date?.getFullYear() ?? null,
    date: track.metadata.date?.toISOString() ?? null,
    genres: track.metadata.genres,
    subgenres: track.metadata.subgenres,
    tags: track.aiMetadata.tags,
    vocalsDesc: track.aiMetadata.vocalsDesc,
    atmosphereDesc: track.aiMetadata.atmosphereDesc,
    contextBackground: track.aiMetadata.contextBackground,
    contextImpact: track.aiMetadata.contextImpact,
    tempo: track.features.musicalFeatures.tempo,
    key: track.features.musicalFeatures.key,
    camelotKey: track.features.musicalFeatures.camelotKey,
    valence: track.features.musicalFeatures.valence,
    valenceMood: track.features.musicalFeatures.valenceMood,
    arousal: track.features.musicalFeatures.arousal,
    arousalMood: track.features.musicalFeatures.arousalMood,
    danceability: track.features.musicalFeatures.danceability,
    danceabilityFeeling: track.features.musicalFeatures.danceabilityFeeling,
  };
};
