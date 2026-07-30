import { FileInfo } from 'src/application/ports/dtos/FileInfo';
import { MusicTrack } from 'src/kernel/types';

export function trackToFileInfo(track: MusicTrack): FileInfo {
  const { filePath, fileName, fileSize, fileCreatedAt } = track.fileInfo;
  const lastDot = fileName.lastIndexOf('.');
  const extension = lastDot >= 0 ? fileName.slice(lastDot) : '';
  return {
    filePath,
    fileName,
    fileSize,
    extension: extension || '.mp3',
    lastModified: fileCreatedAt,
  };
}
