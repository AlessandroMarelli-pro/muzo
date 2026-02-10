import { AudioFeatures } from 'src/application/ports/dtos/AudioFeatures';
import { ElasticsearchTrackDocument } from '../types/elasticsearch-track-document';

/**
 * Generate reasons for audio features that can't be highlighted
 * (k-NN queries, function_score queries, etc.)
 */
const generateAudioFeatureReasons = (
  trackSource: ElasticsearchTrackDocument,
  playlistFeatures: AudioFeatures,
): string[] => {
  const reasons: string[] = [];

  // Camelot key matching (harmonic mixing)
  if (
    trackSource.musical_audio_features?.camelot_key &&
    playlistFeatures.camelotKey &&
    trackSource.musical_audio_features.camelot_key ===
      playlistFeatures.camelotKey
  ) {
    reasons.push(
      `Harmonic key match: ${trackSource.musical_audio_features.camelot_key}`,
    );
  }

  // Audio feature reasons
  if (trackSource.musical_audio_features?.tempo && playlistFeatures.tempo) {
    const tempoDiff = Math.abs(
      trackSource.musical_audio_features.tempo - playlistFeatures.tempo,
    );
    if (tempoDiff <= 10) {
      reasons.push(
        `Similar tempo: ${trackSource.musical_audio_features.tempo} BPM`,
      );
    }
  }

  // Emotional features
  if (
    trackSource.musical_audio_features?.valence !== undefined &&
    playlistFeatures.valence !== undefined
  ) {
    const valenceDiff = Math.abs(
      trackSource.musical_audio_features.valence - playlistFeatures.valence,
    );
    if (valenceDiff <= 0.1) {
      reasons.push(
        `Similar mood: ${trackSource.musical_audio_features.valence_mood || 'matching valence'}`,
      );
    }
  }

  if (
    trackSource.musical_audio_features?.arousal !== undefined &&
    playlistFeatures.arousal !== undefined
  ) {
    const arousalDiff = Math.abs(
      trackSource.musical_audio_features.arousal - playlistFeatures.arousal,
    );
    if (arousalDiff <= 0.1) {
      reasons.push(
        `Similar intensity: ${trackSource.musical_audio_features.arousal_mood || 'matching arousal'}`,
      );
    }
  }

  // Danceability
  if (
    trackSource.musical_audio_features?.danceability !== undefined &&
    playlistFeatures.danceability !== undefined
  ) {
    const danceabilityDiff = Math.abs(
      trackSource.musical_audio_features.danceability -
        playlistFeatures.danceability,
    );
    if (danceabilityDiff <= 0.1) {
      reasons.push(
        `Similar danceability: ${trackSource.musical_audio_features.danceability_feeling || 'matching groove'}`,
      );
    }
  }

  return reasons;
};

const generateRecommendationReasons = (
  trackSource: ElasticsearchTrackDocument,
  playlistFeatures: AudioFeatures,
): string[] => {
  const reasons: string[] = [];

  // Genre reasons (fallback if not in highlights)
  if (
    playlistFeatures.genres &&
    playlistFeatures.genres.length > 0 &&
    trackSource.genres &&
    trackSource.genres.length > 0
  ) {
    const matchingGenres = playlistFeatures.genres.filter((g) =>
      trackSource.genres.includes(g),
    );
    if (matchingGenres.length > 0) {
      reasons.push(
        `Same genre${matchingGenres.length > 1 ? 's' : ''}: ${matchingGenres.join(', ')}`,
      );
    }
  }
  if (
    playlistFeatures.subgenres &&
    playlistFeatures.subgenres.length > 0 &&
    trackSource.subgenres &&
    trackSource.subgenres.length > 0
  ) {
    const matchingSubgenres = playlistFeatures.subgenres.filter((s) =>
      trackSource.subgenres.includes(s),
    );
    if (matchingSubgenres.length > 0) {
      reasons.push(
        `Same subgenre${matchingSubgenres.length > 1 ? 's' : ''}: ${matchingSubgenres.join(', ')}`,
      );
    }
  }

  if (
    trackSource.atmosphere_desc &&
    Array.isArray(trackSource.atmosphere_desc) &&
    playlistFeatures.atmosphereKeywords &&
    playlistFeatures.atmosphereKeywords.length > 0
  ) {
    const commonAtmosphere = trackSource.atmosphere_desc.filter((keyword) =>
      playlistFeatures.atmosphereKeywords?.includes(keyword),
    );
    if (commonAtmosphere.length > 0) {
      reasons.push(
        `Similar atmosphere: ${commonAtmosphere.slice(0, 2).join(', ')}`,
      );
    }
  }

  if (trackSource.vocals_desc && playlistFeatures.vocalsDescriptions) {
    const matchingVocals =
      trackSource.vocals_desc &&
      (trackSource.vocals_desc
        .toLowerCase()
        .includes(playlistFeatures.vocalsDescriptions.toLowerCase()) ||
        playlistFeatures.vocalsDescriptions
          .toLowerCase()
          .includes(trackSource.vocals_desc.toLowerCase()));
    if (matchingVocals) {
      reasons.push('Similar vocal characteristics');
    }
  }

  if (trackSource.context_background && playlistFeatures.contextBackgrounds) {
    const matchingContext =
      trackSource.context_background &&
      (trackSource.context_background
        .toLowerCase()
        .includes(playlistFeatures.contextBackgrounds.toLowerCase()) ||
        playlistFeatures.contextBackgrounds
          .toLowerCase()
          .includes(trackSource.context_background.toLowerCase()));
    if (matchingContext) {
      reasons.push('Similar context background');
    }
  }

  if (trackSource.context_impact && playlistFeatures.contextImpacts) {
    const matchingImpact =
      trackSource.context_impact &&
      (trackSource.context_impact
        .toLowerCase()
        .includes(playlistFeatures.contextImpacts.toLowerCase()) ||
        playlistFeatures.contextImpacts
          .toLowerCase()
          .includes(trackSource.context_impact.toLowerCase()));
    if (matchingImpact) {
      reasons.push('Similar context impact');
    }
  }

  return reasons;
};
/**
 * Extract recommendation reasons directly from Elasticsearch highlights and matched fields
 */
export const extractReasonsFromElasticsearch = (
  hit: any,
  playlistFeatures: AudioFeatures,
): string[] => {
  const reasons: string[] = [];
  const trackSource = hit._source;
  const highlights = hit.highlight || {};

  // Extract reasons from Elasticsearch highlights
  if (highlights.genres && highlights.genres.length > 0) {
    const matchedGenres = highlights.genres
      .map((h: string) => h.replace(/<em>|<\/em>/g, ''))
      .filter((g: string) => trackSource.genres?.includes(g));
    if (matchedGenres.length > 0) {
      reasons.push(
        `Same genre${matchedGenres.length > 1 ? 's' : ''}: ${matchedGenres.slice(0, 3).join(', ')}`,
      );
    }
  }

  if (highlights.subgenres && highlights.subgenres.length > 0) {
    const matchedSubgenres = highlights.subgenres
      .map((h: string) => h.replace(/<em>|<\/em>/g, ''))
      .filter((s: string) => trackSource.subgenres?.includes(s));
    if (matchedSubgenres.length > 0) {
      reasons.push(
        `Same subgenre${matchedSubgenres.length > 1 ? 's' : ''}: ${matchedSubgenres.slice(0, 3).join(', ')}`,
      );
    }
  }

  if (highlights.ai_tags && highlights.ai_tags.length > 0) {
    const matchedTags = highlights.ai_tags
      .map((h: string) => h.replace(/<em>|<\/em>/g, ''))
      .filter((tag: string) => trackSource.ai_tags?.includes(tag));
    if (matchedTags.length > 0) {
      reasons.push(`Similar tags: ${matchedTags.slice(0, 3).join(', ')}`);
    }
  }

  if (highlights.atmosphere_desc && highlights.atmosphere_desc.length > 0) {
    const matchedAtmosphere = highlights.atmosphere_desc
      .map((h: string) => h.replace(/<em>|<\/em>/g, ''))
      .filter((keyword: string) =>
        trackSource.atmosphere_desc?.includes(keyword),
      );
    if (matchedAtmosphere.length > 0) {
      reasons.push(
        `Similar atmosphere: ${matchedAtmosphere.slice(0, 2).join(', ')}`,
      );
    }
  }

  if (highlights.ai_description && highlights.ai_description.length > 0) {
    reasons.push('Similar AI description');
  }

  if (highlights.vocals_desc && highlights.vocals_desc.length > 0) {
    reasons.push('Similar vocal characteristics');
  }

  if (
    highlights.context_background &&
    highlights.context_background.length > 0
  ) {
    reasons.push('Similar context background');
  }

  if (highlights.context_impact && highlights.context_impact.length > 0) {
    reasons.push('Similar context impact');
  }

  if (
    highlights['musical_audio_features.energy_keywords'] &&
    highlights['musical_audio_features.energy_keywords'].length > 0
  ) {
    const matchedKeywords = highlights['musical_audio_features.energy_keywords']
      .map((h: string) => h.replace(/<em>|<\/em>/g, ''))
      .filter((keyword: string) =>
        trackSource.musical_audio_features?.energy_keywords?.includes(keyword),
      );
    if (matchedKeywords.length > 0) {
      reasons.push(`Similar energy: ${matchedKeywords.slice(0, 2).join(', ')}`);
    }
  }

  // Add audio feature reasons that can't be highlighted (tempo, key, energy, etc.)
  // These come from function_score and k-NN queries which don't support highlighting
  const audioFeatureReasons = generateAudioFeatureReasons(
    trackSource,
    playlistFeatures,
  );
  audioFeatureReasons.forEach((reason) => {
    // Avoid duplicates
    if (!reasons.some((r) => r === reason)) {
      reasons.push(reason);
    }
  });

  // If no reasons found at all, fallback to full reason generation
  if (reasons.length === 0) {
    return generateRecommendationReasons(trackSource, playlistFeatures);
  }

  return reasons;
};
