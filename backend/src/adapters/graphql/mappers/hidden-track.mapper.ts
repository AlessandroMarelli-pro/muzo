import { extractModelId } from 'src/kernel/ids/factory';
import type { HiddenMusicTrack } from 'src/kernel/types/model-types';
import type { HiddenTrack } from '../schema/hidden-track.schema';

export function toHiddenTrack(track: HiddenMusicTrack): HiddenTrack {
  return {
    id: track.id,
    artist: track.artist,
    title: track.title,
    imagePath: track.imageData ? extractModelId(track.id).dbId : undefined,
    libraryId: track.libraryId,
    fileName: track.fileInfo.fileName,
    fileSize: track.fileInfo.fileSize,
    duration: track.technicalInfo?.duration,
    format: track.technicalInfo?.format,
    createdAt: track.createdAt,
  };
}
