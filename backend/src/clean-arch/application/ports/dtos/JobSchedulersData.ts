import { FileInfo } from 'src/clean-arch/application/ports/dtos/FileInfo';
import { MusicLibraryId, SessionId } from 'src/clean-arch/kernel/ids';
import { ActionContext } from 'src/clean-arch/kernel/types';

export interface LibraryScanJobData {
  libraryId: MusicLibraryId;
  sessionId: SessionId; // Optional for backward compatibility
  incremental: boolean;
  contextUser: ActionContext['user'];
}

export interface EndLibraryScanJobData {
  libraryId: MusicLibraryId;
  totalTracks: number;
  incremental: boolean;
  sessionId: SessionId;
  contextUser: ActionContext['user'];
}

export type AudioFile = FileInfo & {
  trackIndex: number;
  libraryId: MusicLibraryId;
};

export interface AudioScanBatchJobData {
  audioFiles: AudioFile[];
  sessionId: SessionId;
  contextUser: ActionContext['user'];
  startDateTS: number;
  totalFiles: number;
  totalBatches: number;
  batchIndex: number;
  libraryId: MusicLibraryId;
  incremental: boolean;
}
