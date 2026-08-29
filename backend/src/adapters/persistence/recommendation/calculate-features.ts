import { AudioFeatures } from 'src/application/ports/dtos/AudioFeatures';
import { Maybe, MusicTrack } from 'src/kernel/types';

function findMostCommon(counts: Record<string, number>): string {
  const entries = Object.entries(counts);
  if (entries.length === 0) return '';
  return entries.sort((a, b) => b[1] - a[1])[0][0];
}
function calculateMean(values?: (number | undefined)[]): number {
  const filteredValues = values?.filter((value) => value !== undefined) ?? [];
  if (!filteredValues.length) {
    return 0;
  }
  return filteredValues.reduce((a, b) => a + b, 0) / filteredValues.length;
}

const EMBEDDING_DIM = 1280;

function calculateVectorAggregate(
  tracks: MusicTrack[],
  getVec: (track: MusicTrack) => number[] | undefined,
  dim: number,
): number[] {
  const vecs = tracks
    .map(getVec)
    .filter((v): v is number[] => Array.isArray(v) && v.length >= dim);
  if (vecs.length === 0) {
    return [];
  }
  const out: number[] = [];
  for (let i = 0; i < dim; i += 1) {
    out.push(calculateMean(vecs.map((v) => v[i])));
  }
  return out;
}

/** Mean discogs-effnet embedding across seed tracks; undefined when none have one
 * (single-seed recommendations effectively use that track's own embedding). */
function calculateEmbeddingAggregate(tracks: MusicTrack[]): number[] | undefined {
  const vector = calculateVectorAggregate(
    tracks,
    (track) => track.features?.embedding,
    EMBEDDING_DIM,
  );
  return vector.length > 0 ? vector : undefined;
}

export function calculateFeatures(tracks: MusicTrack[]): Maybe<AudioFeatures> {
  if (tracks.length === 0) {
    return null;
  }
  const features: Required<AudioFeatures> = {
    trackId: tracks[0].id,
    tempo: { min: Infinity, max: 0 },
    tempoCenter: 0,
    valence: 0,
    danceability: 0,
    arousal: 0,
    instrumentalness: 0,
    voice: 0,
    moodHappy: 0,
    moodSad: 0,
    moodRelaxed: 0,
    moodAggressive: 0,
    moodParty: 0,
    key: '',
    camelotKey: '',
    valenceMood: '',
    arousalMood: '',
    danceabilityFeeling: '',
    genres: [],
    subgenres: [],
    artist: '',
    album: '',
    embedding: [],
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

  let validTracks = 0;
  let instrumentalnessSum = 0;
  let instrumentalnessCount = 0;
  let voiceSum = 0;
  let voiceCount = 0;
  const moodSums = { happy: 0, sad: 0, relaxed: 0, aggressive: 0, party: 0 };
  const moodCounts = { happy: 0, sad: 0, relaxed: 0, aggressive: 0, party: 0 };

  tracks.forEach((track) => {
    const mf = track.features?.musicalFeatures;
    const metadata = track.metadata;

    if (mf) {
      if (mf.tempo != null && mf.tempo > 0) {
        features.tempo!.min = Math.min(features.tempo!.min, mf.tempo);
        features.tempo!.max = Math.max(features.tempo!.max, mf.tempo);
        validTracks++;
      }
      if (mf.valence != null) {
        features.valence! += mf.valence;
      }
      if (mf.danceability != null) {
        features.danceability! += mf.danceability;
      }
      if (mf.arousal != null) {
        features.arousal! += mf.arousal;
      }
      if (mf.instrumentalness != null) {
        instrumentalnessSum += mf.instrumentalness;
        instrumentalnessCount++;
      }
      if (mf.voice != null) {
        voiceSum += mf.voice;
        voiceCount++;
      }
      if (mf.moodHappy != null) {
        moodSums.happy += mf.moodHappy;
        moodCounts.happy++;
      }
      if (mf.moodSad != null) {
        moodSums.sad += mf.moodSad;
        moodCounts.sad++;
      }
      if (mf.moodRelaxed != null) {
        moodSums.relaxed += mf.moodRelaxed;
        moodCounts.relaxed++;
      }
      if (mf.moodAggressive != null) {
        moodSums.aggressive += mf.moodAggressive;
        moodCounts.aggressive++;
      }
      if (mf.moodParty != null) {
        moodSums.party += mf.moodParty;
        moodCounts.party++;
      }
      if (mf.key) {
        keyCounts[mf.key] = (keyCounts[mf.key] || 0) + 1;
      }
      if (mf.camelotKey) {
        camelotKeyCounts[mf.camelotKey] = (camelotKeyCounts[mf.camelotKey] || 0) + 1;
      }
      if (mf.valenceMood) {
        valenceMoodCounts[mf.valenceMood] = (valenceMoodCounts[mf.valenceMood] || 0) + 1;
      }
      if (mf.arousalMood) {
        arousalMoodCounts[mf.arousalMood] = (arousalMoodCounts[mf.arousalMood] || 0) + 1;
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
  });

  const embedding = calculateEmbeddingAggregate(tracks);
  if (embedding) {
    features.embedding = embedding;
  }

  features.instrumentalness = instrumentalnessCount > 0 ? instrumentalnessSum / instrumentalnessCount : 0;
  features.voice = voiceCount > 0 ? voiceSum / voiceCount : 0;
  features.moodHappy = moodCounts.happy > 0 ? moodSums.happy / moodCounts.happy : 0;
  features.moodSad = moodCounts.sad > 0 ? moodSums.sad / moodCounts.sad : 0;
  features.moodRelaxed = moodCounts.relaxed > 0 ? moodSums.relaxed / moodCounts.relaxed : 0;
  features.moodAggressive =
    moodCounts.aggressive > 0 ? moodSums.aggressive / moodCounts.aggressive : 0;
  features.moodParty = moodCounts.party > 0 ? moodSums.party / moodCounts.party : 0;

  const n = tracks.length;
  if (validTracks > 0) {
    features.tempo!.min = features.tempo!.min - 5;
    features.tempo!.max = features.tempo!.max + 5;
    features.tempoCenter = (features.tempo!.min + features.tempo!.max) / 2;
  }
  if (n > 0) {
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
    .slice(0, 10);
  features.key = findMostCommon(keyCounts);
  features.camelotKey = findMostCommon(camelotKeyCounts);
  features.artist = findMostCommon(artistCounts);
  features.album = findMostCommon(albumCounts);
  features.valenceMood = findMostCommon(valenceMoodCounts);
  features.arousalMood = findMostCommon(arousalMoodCounts);
  features.danceabilityFeeling = findMostCommon(danceabilityFeelingCounts);

  return features;
}
