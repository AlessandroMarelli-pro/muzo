/**
 * SSE (Server-Sent Events) service for real-time scan progress updates
 * Replaces WebSocket service for scan progress tracking
 */

import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

export interface ScanProgressEvent {
    type:
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
    sessionId: string;
    timestamp: string;
    libraryId?: string;
    batchIndex?: number;
    totalBatches?: number;
    data?: {
        status?: string;
        totalBatches?: number;
        completedBatches?: number;
        totalTracks?: number;
        completedTracks?: number;
        failedTracks?: number;
        startedAt?: string;
        updatedAt?: string;
        tracksInBatch?: number;
        trackIndex?: number;
        fileName?: string;
        progress?: number;
        successful?: number;
        failed?: number;
        duration?: number;
    };
    overallProgress?: number;
}

export interface ScanErrorEvent {
    type: 'error';
    sessionId: string;
    timestamp: string;
    severity: 'warning' | 'error' | 'critical';
    source: 'backend' | 'ai-service';
    libraryId?: string;
    batchIndex?: number;
    trackIndex?: number;
    error: {
        code: string;
        message: string;
        details?: any;
    };
    overallProgress?: number;
}

export type ScanEvent = ScanProgressEvent | ScanErrorEvent;

class SSEService {
    private connections = new Map<string, EventSource>();
    private listeners = new Map<string, Set<(event: ScanEvent) => void>>();
    private queryClient: any = null;

    setQueryClient(queryClient: any) {
        this.queryClient = queryClient;
    }

    /**
     * Connect to SSE endpoint for a scan session
     */
    connect(sessionId: string): EventSource | null {
        if (this.connections.has(sessionId)) {
            // Already connected
            return this.connections.get(sessionId) || null;
        }

        try {
            // Use the same base URL as rest-client
            const baseUrl = 'http://localhost:3000';
            const eventSource = new EventSource(
                `${baseUrl}/scan-progress/${sessionId}`,
            );

            eventSource.onopen = () => {
                console.log(`SSE connection opened for session: ${sessionId}`);
            };

            eventSource.onmessage = (event) => {
                try {
                    const data: ScanEvent = JSON.parse(event.data);
                    this.handleMessage(sessionId, data);
                } catch (error) {
                    console.error(
                        `Failed to parse SSE message for session ${sessionId}:`,
                        error,
                    );
                }
            };

            eventSource.onerror = (error) => {
                console.error(
                    `SSE connection error for session ${sessionId}:`,
                    error,
                );
                // EventSource will automatically attempt to reconnect
            };

            this.connections.set(sessionId, eventSource);
            return eventSource;
        } catch (error) {
            console.error(`Failed to create SSE connection for session ${sessionId}:`, error);
            return null;
        }
    }

    /**
     * Disconnect from SSE endpoint
     */
    disconnect(sessionId: string): void {
        const eventSource = this.connections.get(sessionId);
        if (eventSource) {
            eventSource.close();
            this.connections.delete(sessionId);
            this.listeners.delete(sessionId);
            console.log(`SSE connection closed for session: ${sessionId}`);
        }
    }

    /**
     * Subscribe to events for a session
     */
    subscribe(
        sessionId: string,
        callback: (event: ScanEvent) => void,
    ): () => void {
        // Ensure connection exists
        if (!this.connections.has(sessionId)) {
            this.connect(sessionId);
        }

        // Add listener
        if (!this.listeners.has(sessionId)) {
            this.listeners.set(sessionId, new Set());
        }
        this.listeners.get(sessionId)!.add(callback);

        // Return unsubscribe function
        return () => {
            const listeners = this.listeners.get(sessionId);
            if (listeners) {
                listeners.delete(callback);
                if (listeners.size === 0) {
                    // No more listeners, but keep connection open in case of re-subscription
                    // Connection will be cleaned up when component unmounts
                }
            }
        };
    }

    /**
     * Handle incoming SSE message
     */
    private handleMessage(sessionId: string, event: ScanEvent): void {
        // Update query client cache
        if (this.queryClient && event.type === 'state') {
            this.queryClient.setQueryData(['scan-progress', sessionId], event);
        }

        // Notify all listeners
        const listeners = this.listeners.get(sessionId);
        if (listeners) {
            listeners.forEach((callback) => {
                try {
                    callback(event);
                } catch (error) {
                    console.error('Error in SSE event callback:', error);
                }
            });
        }
    }

    /**
     * Check if connected for a session
     */
    isConnected(sessionId: string): boolean {
        const eventSource = this.connections.get(sessionId);
        return eventSource?.readyState === EventSource.OPEN;
    }

    /**
     * Disconnect all sessions
     */
    disconnectAll(): void {
        const sessionIds = Array.from(this.connections.keys());
        sessionIds.forEach((sessionId) => this.disconnect(sessionId));
    }
}

// Create singleton instance
const sseService = new SSEService();

/**
 * Hook to initialize SSE connection with query client
 */
export const useSSEConnection = () => {
    const queryClient = useQueryClient();

    useEffect(() => {
        sseService.setQueryClient(queryClient);
        return () => {
            // Don't disconnect on cleanup - let individual hooks manage their connections
        };
    }, [queryClient]);
};

/**
 * Hook to get scan progress with real-time updates via SSE
 */
export const useScanProgress = (sessionId?: string) => {
    const queryClient = useQueryClient();
    const [progress, setProgress] = useState<ScanProgressEvent | null>(null);
    const [error, setError] = useState<ScanErrorEvent | null>(null);
    const [isConnected, setIsConnected] = useState(false);

    // Initialize SSE connection
    useSSEConnection();

    useEffect(() => {
        if (!sessionId) {
            return;
        }

        // Connect to SSE
        const eventSource = sseService.connect(sessionId);
        if (eventSource) {
            setIsConnected(true);

            // Subscribe to events
            const unsubscribe = sseService.subscribe(sessionId, (event) => {
                if (event.type === 'error') {
                    setError(event as ScanErrorEvent);
                } else {
                    setProgress(event as ScanProgressEvent);
                    setError(null); // Clear error on successful event
                }
            });

            // Check connection status periodically
            const statusInterval = setInterval(() => {
                setIsConnected(sseService.isConnected(sessionId));
            }, 1000);

            // Cleanup
            return () => {
                unsubscribe();
                clearInterval(statusInterval);
                // Note: We don't disconnect here to allow reconnection
                // Connection will be cleaned up when session completes
            };
        } else {
            setIsConnected(false);
        }
    }, [sessionId]);

    // Get cached data from query client
    const cachedProgress = queryClient.getQueryData<ScanProgressEvent>([
        'scan-progress',
        sessionId,
    ]);

    return {
        progress: progress || cachedProgress || null,
        error,
        isConnected,
        loading: false,
    };
};

export default sseService;
