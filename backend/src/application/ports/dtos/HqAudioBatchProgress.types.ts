export type HqAudioTrackStatus = 'queued' | 'downloading' | 'succeeded' | 'failed' | 'skipped';

export interface HqAudioBatchTrackState {
  trackId: string;
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
  status: 'running' | 'completed';
  startedAt: string;
  updatedAt: string;
  tracks: HqAudioBatchTrackState[];
}

export type HqAudioBatchProgressEventType = 'batch.state' | 'track.update' | 'batch.complete';

export interface HqAudioBatchProgressEvent {
  type: HqAudioBatchProgressEventType;
  batchId: string;
  timestamp: string;
  track?: HqAudioBatchTrackState;
  state: HqAudioBatchState;
}
