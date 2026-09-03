import type { WavMetadata } from 'src/application/ports/infrastructure/IWavConverterWithMetadata';
import type { MusicTrack } from 'src/kernel/types/model-types';

function normalizeMetadataValue(input: string): string {
  return input.replace(/\r?\n/g, ' ').trim();
}

function capitalizeWords(input: string): string {
  return input.replace(/(^|[^\p{L}])(\p{L})/gu, (_m, prefix: string, letter: string) => {
    return `${prefix}${letter.toLocaleUpperCase()}`;
  });
}

function toHashtags(values: string[] | undefined): string {
  return values?.length
    ? normalizeMetadataValue(values.map((v) => `#${v.toLowerCase()}`).join(', '))
    : '';
}

/**
 * Builds the ffmpeg tag payload for a track. Shared by playlist export and
 * acquisition-time tagging so a file carries the same tags wherever it was
 * written. genre/style come from subgenres; comment carries the coarse genres
 * as hashtags (the convention DJ software reads).
 */
export function buildAudioTagMetadata(track: MusicTrack): WavMetadata {
  const artist = track.artist?.trim() ? track.artist : 'Unknown';
  const title = track.title?.trim() ? track.title : 'Unknown';
  const subgenres = toHashtags(track.metadata?.subgenres);
  return {
    artist: normalizeMetadataValue(capitalizeWords(artist)),
    title: normalizeMetadataValue(capitalizeWords(title)),
    genre: subgenres,
    style: subgenres,
    comment: toHashtags(track.metadata?.genres),
  };
}
