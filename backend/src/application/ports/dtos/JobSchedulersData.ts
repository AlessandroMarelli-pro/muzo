import { FileInfo } from 'src/application/ports/dtos/FileInfo';
import { HqAudioBatchId, MusicLibraryId, MusicTrackId, SessionId } from 'src/kernel/ids';
import { ActionContext } from 'src/kernel/types';

export interface LibraryScanJobData {
  libraryId: MusicLibraryId;
  sessionId: SessionId; // Optional for backward compatibility
  incremental: boolean;
  contextUser: ActionContext['user'];
  /** When true, re-analyze every file in the library, skipping the areFilesAnalyzed check. */
  force?: boolean;
  /** When true, skip LLM-based metadata enrichment during analysis. */
  skipAiMetadata?: boolean;
}

export interface EndLibraryScanJobData {
  libraryId: MusicLibraryId;
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
  /** When true, skip areFilesAnalyzed check and re-analyze all files in the batch */
  force?: boolean;
  /** When true, skip Gemini/AI metadata extraction and run DSP-only analysis */
  skipAiMetadata?: boolean;
}

export interface HqAudioAcquireJobData {
  trackId: MusicTrackId;
  contextUser: ActionContext['user'];
}

export interface HqAudioEnhanceJobData {
  trackId: MusicTrackId;
  contextUser: ActionContext['user'];
}

export interface HqAudioBatchAcquireJobData {
  batchId: HqAudioBatchId;
  trackIds: MusicTrackId[];
  contextUser: ActionContext['user'];
}

export interface EmbeddingBackfillJobData {
  trackId: MusicTrackId;
  filePath: string;
  contextUser: ActionContext['user'];
}
