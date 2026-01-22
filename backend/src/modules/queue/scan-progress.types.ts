/**
 * Event types and interfaces for scan progress tracking
 */

export type ScanProgressEventType =
  | 'state'
  | 'scan.started'
  | 'batch.created'
  | 'batch.processing'
  | 'track.processing'
  | 'llm.filename'
  | 'llm.metadata'
  | 'audio.analysis'
  | 'saving'
  | 'track.complete'
  | 'batch.complete'
  | 'scan.complete';

export type ScanErrorSeverity = 'warning' | 'error' | 'critical';

export interface BaseScanProgressEvent {
  type: ScanProgressEventType;
  sessionId: string;
  timestamp: string;
  libraryId?: string;
  batchIndex?: number;
  totalBatches?: number;
  data?: Record<string, any>;
}

export interface ScanStateEvent extends BaseScanProgressEvent {
  type: 'state';
  data: {
    status: string;
    totalBatches: number;
    completedBatches: number;
    totalTracks: number;
    completedTracks: number;
    failedTracks: number;
    progressPercentage: number; // percentage
    startedAt: string;
    updatedAt: string;
  };
}

export interface BatchCreatedEvent extends BaseScanProgressEvent {
  type: 'batch.created';
  data: {
    totalBatches: number;
    totalTracks: number;
  };
  progressPercentage: number;
}

export interface BatchProcessingEvent extends BaseScanProgressEvent {
  type: 'batch.processing';
  batchIndex: number;
  totalBatches: number;
  data: {
    tracksInBatch: number;
  };
  progressPercentage: number;
}

export interface TrackProcessingEvent extends BaseScanProgressEvent {
  type: 'track.processing';
  batchIndex: number;
  data: {
    trackIndex: number;
    totalTracks: number;
    fileName: string;
  };
}

export interface LLMFilenameEvent extends BaseScanProgressEvent {
  type: 'llm.filename';
  batchIndex: number;
  data: {
    trackIndex: number;
    fileName: string;
  };
}

export interface LLMMetadataEvent extends BaseScanProgressEvent {
  type: 'llm.metadata';
  batchIndex: number;
  data: {
    trackIndex: number;
    fileName: string;
  };
}

export interface AudioAnalysisEvent extends BaseScanProgressEvent {
  type: 'audio.analysis';
  batchIndex: number;
  data: {
    trackIndex: number;
    progress: number; // percentage
    fileName: string;
  };
}

export interface SavingEvent extends BaseScanProgressEvent {
  type: 'saving';
  batchIndex: number;
  data: {
    trackIndex: number;
    fileName: string;
  };
}

export interface TrackCompleteEvent extends BaseScanProgressEvent {
  type: 'track.complete';
  batchIndex: number;
  data: {
    trackIndex: number;
    fileName: string;
    success: boolean;
    totalTracks: number
  };
}

export interface BatchCompleteEvent extends BaseScanProgressEvent {
  type: 'batch.complete';
  batchIndex: number;
  data: {
    successful: number;
    failed: number;
    totalTracks: number;
  };
  progressPercentage: number;
}

export interface ScanCompleteEvent extends BaseScanProgressEvent {
  type: 'scan.complete';
  data: {
    totalBatches: number;
    totalTracks: number;
    successful: number;
    failed: number;
    duration: number; // milliseconds
  };
  progressPercentage: number;
}

export interface ScanErrorEvent {
  type: 'error';
  sessionId: string;
  timestamp: string;
  severity: ScanErrorSeverity;
  source: 'backend' | 'ai-service';
  libraryId?: string;
  batchIndex?: number;
  trackIndex?: number;
  error: {
    code: string;
    message: string;
    details?: any;
  };
}

export type ScanProgressEvent =
  | ScanStateEvent
  | BatchCreatedEvent
  | BatchProcessingEvent
  | TrackProcessingEvent
  | LLMFilenameEvent
  | LLMMetadataEvent
  | AudioAnalysisEvent
  | SavingEvent
  | TrackCompleteEvent
  | BatchCompleteEvent
  | ScanCompleteEvent;
