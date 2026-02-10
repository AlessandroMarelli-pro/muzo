import { AudioFeatures } from 'src/application/ports/dtos/AudioFeatures';
import { MusicTrack } from 'src/kernel/types';

function findMostCommon(counts: Record<string, number>): string {
  const entries = Object.entries(counts);
  if (entries.length === 0) return '';
  return entries.sort((a, b) => b[1] - a[1])[0][0];
}

export function calculateFeatures(tracks: MusicTrack[]): AudioFeatures {
  if (tracks.length === 0) {
    throw new Error('calculateFeatures requires at least one track');
  }

  const features: Required<AudioFeatures> = {
    trackId: tracks[0].id,
    tempo: 0,
    energy: 0,
    valence: 0,
    danceability: 0,
    arousal: 0,
    key: '',
    camelotKey: '',
    valenceMood: '',
    arousalMood: '',
    danceabilityFeeling: '',
    genres: [],
    subgenres: [],
    artist: '',
    album: '',
    aiDescriptions: [],
    aiTags: [],
    vocalsDescriptions: '',
    atmosphereKeywords: [],
    contextBackgrounds: '',
    contextImpacts: '',
  };

  const genreCounts: Record<string, number> = {};
  const subgenreCounts: Record<string, number> = {};
  const keyCounts: Record<string, number> = {};
  const camelotKeyCounts: Record<string, number> = {};
  const artistCounts: Record<string, number> = {};
  const albumCounts: Record<string, number> = {};
  const valenceMoodCounts: Record<string, number> = {};
  const arousalMoodCounts: Record<string, number> = {};
  const danceabilityFeelingCounts: Record<string, number> = {};

  const aiDescriptions: string[] = [];
  const aiTags: string[] = [];
  const vocalsDescriptions: string[] = [];
  const atmosphereKeywords: string[] = [];
  const contextBackgrounds: string[] = [];
  const contextImpacts: string[] = [];

  let validTracks = 0;

  tracks.forEach((track) => {
    const mf = track.features?.musicalFeatures;
    const metadata = track.metadata;
    const aiMetadata = track.aiMetadata;

    if (mf) {
      if (mf.tempo != null && mf.tempo > 0) {
        features.tempo! += mf.tempo;
        validTracks++;
      }
      if (mf.energy != null && mf.energy !== undefined) {
        features.energy! += mf.energy;
      }
      if (mf.valence != null && mf.valence !== undefined) {
        features.valence! += mf.valence;
      }
      if (mf.danceability != null && mf.danceability !== undefined) {
        features.danceability! += mf.danceability;
      }
      if (mf.arousal != null && mf.arousal !== undefined) {
        features.arousal! += mf.arousal;
      }
      if (mf.key) {
        keyCounts[mf.key] = (keyCounts[mf.key] || 0) + 1;
      }
      if (mf.camelotKey) {
        camelotKeyCounts[mf.camelotKey] =
          (camelotKeyCounts[mf.camelotKey] || 0) + 1;
      }
      if (mf.valenceMood) {
        valenceMoodCounts[mf.valenceMood] =
          (valenceMoodCounts[mf.valenceMood] || 0) + 1;
      }
      if (mf.arousalMood) {
        arousalMoodCounts[mf.arousalMood] =
          (arousalMoodCounts[mf.arousalMood] || 0) + 1;
      }
      if (mf.danceabilityFeeling) {
        danceabilityFeelingCounts[mf.danceabilityFeeling] =
          (danceabilityFeelingCounts[mf.danceabilityFeeling] || 0) + 1;
      }
    }

    if (metadata?.genres?.length) {
      for (const genreName of metadata.genres) {
        genreCounts[genreName] = (genreCounts[genreName] || 0) + 1;
      }
    }
    if (metadata?.subgenres?.length) {
      for (const subgenreName of metadata.subgenres) {
        subgenreCounts[subgenreName] = (subgenreCounts[subgenreName] || 0) + 1;
      }
    }

    if (track.artist) {
      artistCounts[track.artist] = (artistCounts[track.artist] || 0) + 1;
    }
    if (metadata?.album) {
      albumCounts[metadata.album] = (albumCounts[metadata.album] || 0) + 1;
    }

    if (aiMetadata?.description) {
      aiDescriptions.push(aiMetadata.description);
    }
    if (aiMetadata?.tags?.length) {
      aiTags.push(...aiMetadata.tags);
    }
    if (aiMetadata?.vocalsDesc) {
      vocalsDescriptions.push(aiMetadata.vocalsDesc);
    }
    if (aiMetadata?.atmosphereDesc?.length) {
      atmosphereKeywords.push(...aiMetadata.atmosphereDesc);
    }
    if (aiMetadata?.contextBackground) {
      contextBackgrounds.push(aiMetadata.contextBackground);
    }
    if (aiMetadata?.contextImpact) {
      contextImpacts.push(aiMetadata.contextImpact);
    }
  });

  const n = tracks.length;
  if (validTracks > 0) {
    features.tempo = features.tempo! / validTracks;
  }
  if (n > 0) {
    features.energy = features.energy! / n;
    features.valence = features.valence! / n;
    features.danceability = features.danceability! / n;
    features.arousal = features.arousal! / n;
  }

  // Get all genres and subgenres (as arrays)
  features.genres = Object.keys(genreCounts).filter(
    (genre) => genreCounts[genre] > 0,
  );
  features.subgenres = Object.keys(subgenreCounts).filter(
    (subgenre) => subgenreCounts[subgenre] > 0,
  );
  features.key = findMostCommon(keyCounts);
  features.camelotKey = findMostCommon(camelotKeyCounts);
  features.artist = findMostCommon(artistCounts);
  features.album = findMostCommon(albumCounts);
  features.valenceMood = findMostCommon(valenceMoodCounts);
  features.arousalMood = findMostCommon(arousalMoodCounts);
  features.danceabilityFeeling = findMostCommon(danceabilityFeelingCounts);

  // Aggregate AI metadata (collect unique values and most common)
  if (aiDescriptions.length > 0) {
    features.aiDescriptions = [...new Set(aiDescriptions)];
  }
  if (aiTags.length > 0) {
    const tagCounts: Record<string, number> = {};
    aiTags.forEach((tag) => {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    });
    features.aiTags = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag]) => tag);
  }
  if (vocalsDescriptions.length > 0) {
    // Find the most common vocals description
    const vocalsCounts: Record<string, number> = {};
    vocalsDescriptions.forEach((vocals) => {
      vocalsCounts[vocals] = (vocalsCounts[vocals] || 0) + 1;
    });
    const mostCommonVocals = Object.entries(vocalsCounts).sort(
      (a, b) => b[1] - a[1],
    )[0]?.[0];
    if (mostCommonVocals) {
      features.vocalsDescriptions = mostCommonVocals;
    }
  }
  if (atmosphereKeywords.length > 0) {
    const atmosphereCounts: Record<string, number> = {};
    atmosphereKeywords.forEach((keyword) => {
      atmosphereCounts[keyword] = (atmosphereCounts[keyword] || 0) + 1;
    });
    features.atmosphereKeywords = Object.entries(atmosphereCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([keyword]) => keyword);
  }
  if (contextBackgrounds.length > 0) {
    // Find the most common context background
    const contextCounts: Record<string, number> = {};
    contextBackgrounds.forEach((context) => {
      contextCounts[context] = (contextCounts[context] || 0) + 1;
    });
    const mostCommonContext = Object.entries(contextCounts).sort(
      (a, b) => b[1] - a[1],
    )[0]?.[0];
    if (mostCommonContext) {
      features.contextBackgrounds = mostCommonContext;
    }
  }
  if (contextImpacts.length > 0) {
    // Find the most common context impact
    const impactCounts: Record<string, number> = {};
    contextImpacts.forEach((impact) => {
      impactCounts[impact] = (impactCounts[impact] || 0) + 1;
    });
    const mostCommonImpact = Object.entries(impactCounts).sort(
      (a, b) => b[1] - a[1],
    )[0]?.[0];
    if (mostCommonImpact) {
      features.contextImpacts = mostCommonImpact;
    }
  }

  return features;
}
