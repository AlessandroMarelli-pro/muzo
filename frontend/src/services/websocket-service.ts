import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

export interface LibraryScanProgressUpdate {
  libraryId: string;
  libraryName: string;
  totalFiles: number;
  processedFiles: number;
  remainingFiles: number;
  progressPercentage: number;
  status: 'SCANNING' | 'COMPLETED' | 'FAILED' | 'IDLE';
  estimatedCompletion?: string;
}

interface WebSocketMessage {
  type: 'library-scan-progress';
  data: LibraryScanProgressUpdate;
}

class WebSocketService {
  private socket: Socket | null = null;
  private queryClient: any = null;
  private listeners: Set<(data: LibraryScanProgressUpdate) => void> = new Set();

  constructor() {
    this.connect();
  }

  setQueryClient(queryClient: any) {
    this.queryClient = queryClient;
  }

  addListener(listener: (data: LibraryScanProgressUpdate) => void) {
    this.listeners.add(listener);
  }

  removeListener(listener: (data: LibraryScanProgressUpdate) => void) {
    this.listeners.delete(listener);
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  private connect() {
    try {
      this.socket = io('http://localhost:3000', {
        transports: ['websocket'],
        autoConnect: true,
      });

      this.socket.on('connect', () => {
        console.log('Socket.IO connected');
        this.subscribeToLibraryScanProgress();
      });

      this.socket.on('library-scan-progress', (message: WebSocketMessage) => {
        this.handleMessage(message);
      });

      this.socket.on('disconnect', () => {
        console.log('Socket.IO disconnected');
      });

      this.socket.on('connect_error', (error) => {
        console.error('Socket.IO connection error:', error);
      });
    } catch (error) {
      console.error('Failed to create Socket.IO connection:', error);
    }
  }

  private subscribeToLibraryScanProgress() {
    if (this.socket && this.socket.connected) {
      this.socket.emit('subscribe-library-progress', {});
    }
  }

  private handleMessage(message: WebSocketMessage) {
    console.log('Received message:', message);

    if (!this.queryClient) {
      console.warn('Query client not set, cannot update progress');
      return;
    }

    switch (message.type) {
      case 'library-scan-progress':
        console.log('Processing library-scan-progress message:', message);
        this.updateLibraryScanProgress(message.data);
        break;
      default:
        console.log('Unknown message type:', message.type);
    }
  }

  private updateLibraryScanProgress(progress: LibraryScanProgressUpdate) {
    if (!this.queryClient) {
      console.warn('Query client not available for progress update');
      return;
    }

    console.log('Updating library scan progress:', progress);
    console.log('Number of listeners:', this.listeners.size);

    // Notify all listeners
    this.listeners.forEach((listener) => {
      console.log('Notifying listener with progress:', progress);
      listener(progress);
    });

    // Update the query cache with the new progress data
    this.queryClient.setQueryData(
      ['library-scan-progress', progress.libraryId],
      progress,
    );

    // Also invalidate the library query to trigger a refetch of library data
    this.queryClient.invalidateQueries({
      queryKey: ['libraries'],
    });

    this.queryClient.invalidateQueries({
      queryKey: ['libraries', progress.libraryId],
    });

    console.log('Successfully updated library scan progress:', progress);
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

// Create a singleton instance
const webSocketService = new WebSocketService();

// Hook to initialize WebSocket connection with query client
export const useWebSocketConnection = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    // Always set the query client, regardless of connection status
    webSocketService.setQueryClient(queryClient);

    if (!webSocketService.isConnected()) {
      console.log('WebSocket not connected yet, will connect automatically');
    } else {
      console.log('WebSocket connection already established');
    }

    return () => {
      // Don't disconnect on cleanup - let the singleton manage the connection
      // webSocketService.disconnect();
    };
  }, [queryClient]);
};

// Hook to get library scan progress with real-time updates
export const useLibraryScanProgress = (libraryId?: string) => {
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState<LibraryScanProgressUpdate | null>(
    null,
  );

  // Initialize WebSocket connection
  useWebSocketConnection();

  useEffect(() => {
    const handleProgressUpdate = (data: LibraryScanProgressUpdate) => {
      // Only update if this is for the specific library or if no libraryId is specified
      console.log('handleProgressUpdate called with data:', data);
      console.log('Current libraryId:', libraryId);
      console.log('Data libraryId:', data.libraryId);

      if (!libraryId || data.libraryId === libraryId) {
        console.log('Updating progress state with:', data);
        setProgress(data);
      } else {
        console.log('Progress update filtered out - libraryId mismatch');
      }
    };

    console.log('Adding progress listener for libraryId:', libraryId);
    webSocketService.addListener(handleProgressUpdate);

    return () => {
      console.log('Removing progress listener for libraryId:', libraryId);
      webSocketService.removeListener(handleProgressUpdate);
    };
  }, [libraryId]);

  // Also get cached data from query client
  const cachedProgress = queryClient.getQueryData<LibraryScanProgressUpdate>([
    'library-scan-progress',
    libraryId,
  ]);

  return {
    progress: progress || cachedProgress || null,
    loading: false,
    error: null,
  };
};
