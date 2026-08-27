/**
 * SSE (Server-Sent Events) service for real-time HQ audio batch download progress
 */

import { useEffect, useState } from 'react';

import { API_BASE_URL } from '@/lib/api-config';

export type HqAudioTrackStatus =
  | 'queued'
  | 'downloading'
  | 'succeeded'
  | 'failed'
  | 'skipped'
  | 'cancelled';

export interface HqAudioBatchTrackState {
  trackId: string;
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

export interface HqAudioBatchProgressEvent {
  type: 'batch.state' | 'track.update' | 'batch.complete' | 'batch.cancelled';
  batchId: string;
  timestamp: string;
  track?: HqAudioBatchTrackState;
  state: HqAudioBatchState;
}

class HqAudioBatchSSEService {
  private connections = new Map<string, EventSource>();
  private listeners = new Map<string, Set<(event: HqAudioBatchProgressEvent) => void>>();

  connect(batchId: string): EventSource | null {
    if (this.connections.has(batchId)) {
      return this.connections.get(batchId) || null;
    }

    try {
      const eventSource = new EventSource(`${API_BASE_URL}/hq-audio-batch-progress/${batchId}`, {
        withCredentials: true,
      });

      eventSource.onmessage = (event) => {
        try {
          const data: HqAudioBatchProgressEvent = JSON.parse(event.data);
          this.handleMessage(batchId, data);
        } catch (error) {
          console.error(`Failed to parse SSE message for batch ${batchId}:`, error);
        }
      };

      eventSource.onerror = (error) => {
        console.error(`SSE connection error for batch ${batchId}:`, error);
      };

      this.connections.set(batchId, eventSource);
      return eventSource;
    } catch (error) {
      console.error(`Failed to create SSE connection for batch ${batchId}:`, error);
      return null;
    }
  }

  disconnect(batchId: string): void {
    const eventSource = this.connections.get(batchId);
    if (eventSource) {
      eventSource.close();
      this.connections.delete(batchId);
      this.listeners.delete(batchId);
    }
  }

  subscribe(batchId: string, callback: (event: HqAudioBatchProgressEvent) => void): () => void {
    if (!this.connections.has(batchId)) {
      this.connect(batchId);
    }

    if (!this.listeners.has(batchId)) {
      this.listeners.set(batchId, new Set());
    }
    this.listeners.get(batchId)!.add(callback);

    return () => {
      const listeners = this.listeners.get(batchId);
      if (listeners) {
        listeners.delete(callback);
      }
    };
  }

  private handleMessage(batchId: string, event: HqAudioBatchProgressEvent): void {
    const listeners = this.listeners.get(batchId);
    if (listeners) {
      listeners.forEach((callback) => {
        try {
          callback(event);
        } catch (error) {
          console.error('Error in HQ audio batch SSE event callback:', error);
        }
      });
    }
  }

  isConnected(batchId: string): boolean {
    const eventSource = this.connections.get(batchId);
    return eventSource?.readyState === EventSource.OPEN;
  }
}

const hqAudioBatchSSEService = new HqAudioBatchSSEService();

export const useHqAudioBatchProgress = (batchId?: string) => {
  const [state, setState] = useState<HqAudioBatchState | null>(null);
  const [latestEvent, setLatestEvent] = useState<HqAudioBatchProgressEvent | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!batchId) {
      return;
    }

    const eventSource = hqAudioBatchSSEService.connect(batchId);
    if (eventSource) {
      setIsConnected(true);

      const unsubscribe = hqAudioBatchSSEService.subscribe(batchId, (event) => {
        setLatestEvent(event);
        setState((current) => {
          // Guard against an older snapshot arriving after a newer one (e.g. network delivery
          // jitter) from silently rolling the dialog back to a less-complete state.
          if (current && event.state.updatedAt < current.updatedAt) {
            return current;
          }
          return event.state;
        });
      });

      const statusInterval = setInterval(() => {
        setIsConnected(hqAudioBatchSSEService.isConnected(batchId));
      }, 1000);

      return () => {
        unsubscribe();
        clearInterval(statusInterval);
        hqAudioBatchSSEService.disconnect(batchId);
      };
    } else {
      setIsConnected(false);
    }
  }, [batchId]);

  useEffect(() => {
    if (batchId && (state?.status === 'completed' || state?.status === 'cancelled')) {
      hqAudioBatchSSEService.disconnect(batchId);
    }
  }, [batchId, state?.status]);

  return { state, latestEvent, isConnected };
};

export default hqAudioBatchSSEService;
