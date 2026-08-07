export type HqAudioTrackStatus =
  | 'queued'
  | 'downloading'
  | 'succeeded'
  | 'failed'
  | 'skipped'
  | 'cancelled';

export interface HqAudioBatchTrackState {
  trackId: string;
  /** Position in the playlist at batch-start time; used to render tracks in a stable order. */
  position: number;
  artist: string;
  title: string;
  status: HqAudioTrackStatus;
  errorMessage?: string;
}

export interface HqAudioBatchState {
  batchId: string;
  playlistId: string;
  total: number;
  queued: number;
  downloading: number;
  succeeded: number;
  failed: number;
  skipped: number;
  cancelled: number;
  status: 'running' | 'completed' | 'cancelled';
  startedAt: string;
  updatedAt: string;
  tracks: HqAudioBatchTrackState[];
}

export type HqAudioBatchProgressEventType =
  | 'batch.state'
  | 'track.update'
  | 'batch.complete'
  | 'batch.cancelled';

export interface HqAudioBatchProgressEvent {
  type: HqAudioBatchProgressEventType;
  batchId: string;
  timestamp: string;
  track?: HqAudioBatchTrackState;
  state: HqAudioBatchState;
}
