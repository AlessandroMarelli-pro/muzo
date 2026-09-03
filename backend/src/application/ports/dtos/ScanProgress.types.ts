/**
 * Event types and interfaces for scan progress tracking.
 *
 * This union only lists event types something actually emits. It used to also declare
 * 'scan.started', 'batch.created', 'batch.processing', 'track.processing', 'llm.filename',
 * 'llm.metadata', 'audio.analysis' and 'saving' -- those were either never wired up, or were
 * only ever published by the ai-service's Redis-based publisher, which HF disables entirely
 * (DISABLE_REDIS=true) and which has since been removed. A contract that lists events nobody
 * sends is how a stale totalTracks: 0 on the frontend went unnoticed for so long -- keep this
 * list honest.
 *
 * Progress correctness does not depend on any of these events arriving: `state` is also
 * pushed by StreamSession on a short poll of the ScanSession DB row, which is the source of
 * truth. The others are a low-latency nudge on top of that, nothing more.
 */

import { MaybeUndefined } from 'src/kernel/common';

export type ScanProgressEventType =
  | 'state'
  | 'track.complete'
  | 'tracks.already.analyzed'
  | 'batch.complete'
  | 'scan.complete';

export type ScanErrorSeverity = 'warning' | 'error' | 'critical';

export type EtaConfidence = 'warming-up' | 'low' | 'medium' | 'high';

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
    startedAt: Date;
    updatedAt: MaybeUndefined<Date>;
    /** Seconds until completion at the current average rate, or null with not enough signal
     * yet / nothing left to estimate. See estimate-completion.ts. */
    etaSeconds: number | null;
    /** Session-wide average tracks processed per second. Null under the same conditions as etaSeconds. */
    tracksPerSecond: number | null;
    /** How much to trust etaSeconds -- 'warming-up' means the UI should show no number at all. */
    confidence: EtaConfidence;
    elapsedSeconds: number;
  };
  /** 0-100 percentage. Stored as basis points (0-10000) in the DB; converted at this boundary. */
  overallProgress: number;
}

export interface TrackCompleteEvent extends BaseScanProgressEvent {
  type: 'track.complete';
  batchIndex: number;
  data: {
    trackIndex: number;
    fileName: string;
    success: boolean;
    totalTracks: number;
  };
}

export interface TrackAlreadyAnalyzedEvent extends BaseScanProgressEvent {
  type: 'tracks.already.analyzed';
  batchIndex: number;
  data: {
    fileName: string;
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
  /** 0-100 percentage -- see ScanStateEvent.overallProgress. */
  overallProgress: number;
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
  /** 0-100 percentage -- see ScanStateEvent.overallProgress. */
  overallProgress: number;
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
  | TrackCompleteEvent
  | TrackAlreadyAnalyzedEvent
  | BatchCompleteEvent
  | ScanCompleteEvent;
