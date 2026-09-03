/**
 * Single source of truth for "is this track already high-quality?" and related
 * format checks. Previously this logic was copy-pasted across AcquireHqAudio,
 * EnhanceHqAudio and StartHqAudioBatchDownload; keeping it here means the
 * definition of "HQ" stays consistent as it grows richer (verification,
 * source provenance, etc).
 */

/** Lossless container extensions we treat as already-HQ (no acquisition needed). */
export const HQ_EXTENSIONS = ['flac', 'wav', 'aiff', 'aif'] as const;

const HQ_FORMATS = ['flac', 'wav', 'aiff'] as const;

/** Extracts a lowercased extension from a path or bare extension string. */
function toExtension(pathOrExt?: string | null): string | undefined {
  if (!pathOrExt) {
    return undefined;
  }
  return pathOrExt.split('.').pop()?.toLowerCase();
}

/** True when the given file path (or bare extension) is a lossless container. */
export function isLosslessExtension(pathOrExt?: string | null): boolean {
  const ext = toExtension(pathOrExt);
  return !!ext && (HQ_EXTENSIONS as readonly string[]).includes(ext);
}

/** True when a technicalInfo.format string names a lossless format. */
export function isLosslessFormat(format?: string | null): boolean {
  return !!format && (HQ_FORMATS as readonly string[]).includes(format.toLowerCase());
}

export interface HqStatusTrack {
  hqAudioPath?: string | null;
  fileInfo: { filePath: string };
  technicalInfo?: { format?: string | null } | null;
}

/**
 * True when the track needs no HQ acquisition: it already has an acquired HQ
 * file, or its original library file is itself lossless.
 */
export function isTrackAlreadyHq(track: HqStatusTrack): boolean {
  if (track.hqAudioPath) {
    return true;
  }
  return (
    isLosslessExtension(track.fileInfo.filePath) ||
    isLosslessFormat(track.technicalInfo?.format)
  );
}
