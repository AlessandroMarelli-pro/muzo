import { AudioFeatures } from 'src/application/ports/dtos/AudioFeatures';
import { Maybe, MusicTrack } from 'src/kernel/types';

function findMostCommon(counts: Record<string, number>): string {
  const entries = Object.entries(counts);
  if (entries.length === 0) return '';
  return entries.sort((a, b) => b[1] - a[1])[0][0];
}
function calculateMean(values?: (number | undefined)[]): number {
  const filteredValues = values?.filter((value) => value !== undefined) ?? [];
  if (!filteredValues) return 0;
  return filteredValues.reduce((a, b) => a + b, 0) / filteredValues.length;
}
function calculateSpectralFeaturesMean(tracks: MusicTrack[]) {
  const numberOfTracks = tracks.length;
  return {
    spectralCentroidMean: {
      mean: calculateMean(
        tracks.map(
          (track) => track.features?.spectralFeatures?.spectralCentroid.mean,
        ),
      ),
      std: calculateMean(
        tracks.map(
          (track) => track.features?.spectralFeatures?.spectralCentroid.std,
        ),
      ),
      max: calculateMean(
        tracks.map(
          (track) => track.features?.spectralFeatures?.spectralCentroid.max,
        ),
      ),
      min: calculateMean(
        tracks.map(
          (track) => track.features?.spectralFeatures?.spectralCentroid.min,
        ),
      ),
      p25: calculateMean(
        tracks.map(
          (track) => track.features?.spectralFeatures?.spectralCentroid.p25,
        ),
      ),
      p75: calculateMean(
        tracks.map(
          (track) => track.features?.spectralFeatures?.spectralCentroid.p75,
        ),
      ),
      median: calculateMean(
        tracks.map(
          (track) => track.features?.spectralFeatures?.spectralCentroid.median,
        ),
      ),
    },
    spectralRolloffMean: {
      mean: calculateMean(
        tracks.map(
          (track) => track.features?.spectralFeatures?.spectralRolloff.mean,
        ),
      ),
      std: calculateMean(
        tracks.map(
          (track) => track.features?.spectralFeatures?.spectralRolloff.std,
        ),
      ),
      max: calculateMean(
        tracks.map(
          (track) => track.features?.spectralFeatures?.spectralRolloff.max,
        ),
      ),
      min: calculateMean(
        tracks.map(
          (track) => track.features?.spectralFeatures?.spectralRolloff.min,
        ),
      ),
      p25: calculateMean(
        tracks.map(
          (track) => track.features?.spectralFeatures?.spectralRolloff.p25,
        ),
      ),
      p75: calculateMean(
        tracks.map(
          (track) => track.features?.spectralFeatures?.spectralRolloff.p75,
        ),
      ),
      median: calculateMean(
        tracks.map(
          (track) => track.features?.spectralFeatures?.spectralRolloff.median,
        ),
      ),
    },
    spectralSpreadMean: {
      mean: calculateMean(
        tracks.map(
          (track) => track.features?.spectralFeatures?.spectralSpread.mean,
        ),
      ),
      std: calculateMean(
        tracks.map(
          (track) => track.features?.spectralFeatures?.spectralSpread.std,
        ),
      ),
      max: calculateMean(
        tracks.map(
          (track) => track.features?.spectralFeatures?.spectralSpread.max,
        ),
      ),
      min: calculateMean(
        tracks.map(
          (track) => track.features?.spectralFeatures?.spectralSpread.min,
        ),
      ),
      p25: calculateMean(
        tracks.map(
          (track) => track.features?.spectralFeatures?.spectralSpread.p25,
        ),
      ),
      p75: calculateMean(
        tracks.map(
          (track) => track.features?.spectralFeatures?.spectralSpread.p75,
        ),
      ),
      median: calculateMean(
        tracks.map(
          (track) => track.features?.spectralFeatures?.spectralSpread.median,
        ),
      ),
    },
    spectralBandwidthMean: {
      mean: calculateMean(
        tracks.map(
          (track) => track.features?.spectralFeatures?.spectralBandwith.mean,
        ),
      ),
      std: calculateMean(
        tracks.map(
          (track) => track.features?.spectralFeatures?.spectralBandwith.std,
        ),
      ),
      max: calculateMean(
        tracks.map(
          (track) => track.features?.spectralFeatures?.spectralBandwith.max,
        ),
      ),
      min: calculateMean(
        tracks.map(
          (track) => track.features?.spectralFeatures?.spectralBandwith.min,
        ),
      ),
      p25: calculateMean(
        tracks.map(
          (track) => track.features?.spectralFeatures?.spectralBandwith.p25,
        ),
      ),
      p75: calculateMean(
        tracks.map(
          (track) => track.features?.spectralFeatures?.spectralBandwith.p75,
        ),
      ),
      median: calculateMean(
        tracks.map(
          (track) => track.features?.spectralFeatures?.spectralBandwith.median,
        ),
      ),
    },
    spectralFlatnessMean: {
      mean: calculateMean(
        tracks.map(
          (track) => track.features?.spectralFeatures?.spectralFlatness.mean,
        ),
      ),
      std: calculateMean(
        tracks.map(
          (track) => track.features?.spectralFeatures?.spectralFlatness.std,
        ),
      ),
      max: calculateMean(
        tracks.map(
          (track) => track.features?.spectralFeatures?.spectralFlatness.max,
        ),
      ),
      min: calculateMean(
        tracks.map(
          (track) => track.features?.spectralFeatures?.spectralFlatness.min,
        ),
      ),
      p25: calculateMean(
        tracks.map(
          (track) => track.features?.spectralFeatures?.spectralFlatness.p25,
        ),
      ),
      p75: calculateMean(
        tracks.map(
          (track) => track.features?.spectralFeatures?.spectralFlatness.p75,
        ),
      ),
      median: calculateMean(
        tracks.map(
          (track) => track.features?.spectralFeatures?.spectralFlatness.median,
        ),
      ),
    },
    zeroCrossingRateMean: {
      mean: calculateMean(
        tracks.map(
          (track) => track.features?.spectralFeatures?.zeroCrossingRate.mean,
        ),
      ),
      std: calculateMean(
        tracks.map(
          (track) => track.features?.spectralFeatures?.zeroCrossingRate.std,
        ),
      ),
      max: calculateMean(
        tracks.map(
          (track) => track.features?.spectralFeatures?.zeroCrossingRate.max,
        ),
      ),
      min: calculateMean(
        tracks.map(
          (track) => track.features?.spectralFeatures?.zeroCrossingRate.min,
        ),
      ),
      p25: calculateMean(
        tracks.map(
          (track) => track.features?.spectralFeatures?.zeroCrossingRate.p25,
        ),
      ),
      p75: calculateMean(
        tracks.map(
          (track) => track.features?.spectralFeatures?.zeroCrossingRate.p75,
        ),
      ),
      median: calculateMean(
        tracks.map(
          (track) => track.features?.spectralFeatures?.zeroCrossingRate.median,
        ),
      ),
    },
    mfccMean: [],
  };
}
export function calculateFeatures(tracks: MusicTrack[]): Maybe<AudioFeatures> {
  if (tracks.length === 0) {
    return null;
  }
  const defaultAggregationStatistics = {
    mean: 0,
    std: 0,
    max: 0,
    min: 0,
    p25: 0,
    p75: 0,
    median: 0,
  };
  const defaultMfcc: number[] = Array(26).fill(0);
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
    spectralFeatures: {
      spectralCentroidMean: defaultAggregationStatistics,
      spectralRolloffMean: defaultAggregationStatistics,
      spectralSpreadMean: defaultAggregationStatistics,
      spectralBandwidthMean: defaultAggregationStatistics,
      spectralFlatnessMean: defaultAggregationStatistics,
      zeroCrossingRateMean: defaultAggregationStatistics,
      mfccMean: defaultMfcc,
    },
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
    if (aiMetadata?.atmosphereTags?.length) {
      atmosphereKeywords.push(...aiMetadata.atmosphereTags);
    }
    if (aiMetadata?.contextBackground) {
      contextBackgrounds.push(aiMetadata.contextBackground);
    }
    if (aiMetadata?.contextImpact) {
      contextImpacts.push(aiMetadata.contextImpact);
    }
  });

  features.spectralFeatures = calculateSpectralFeaturesMean(tracks);
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
  // Sort genres and subgenres by count
  features.genres = Object.keys(genreCounts)
    .filter((genre) => genreCounts[genre] > 0)
    .sort((a, b) => genreCounts[b] - genreCounts[a])
    .slice(0, 3);

  features.subgenres = Object.keys(subgenreCounts)
    .filter((subgenre) => subgenreCounts[subgenre] > 0)
    .sort((a, b) => subgenreCounts[b] - subgenreCounts[a])
    .slice(0, 5);
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
