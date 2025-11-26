import { io, Socket } from 'socket.io-client';
import { PlaybackState } from './music-player-hooks';

export interface MusicPlayerWebSocketEvents {
  'playback-state-update': (data: {
    type: string;
    data: PlaybackState;
  }) => void;
  'playback-stopped': (data: {
    type: string;
    data: { trackId: string };
  }) => void;
  connection: (data: {
    type: string;
    message: string;
    clientId: string;
  }) => void;
  'subscription-confirmed': (data: {
    type: string;
    message: string;
    trackId: string;
  }) => void;
  'unsubscription-confirmed': (data: {
    type: string;
    message: string;
    trackId: string;
  }) => void;
}

export class MusicPlayerWebSocketService {
  private socket: Socket | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  constructor(private baseUrl: string = 'http://localhost:3000') {}

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.socket?.connected) {
        resolve();
        return;
      }

      this.socket = io(`${this.baseUrl}/music-player`, {
        transports: ['websocket'],
        timeout: 10000,
      });

      this.socket.on('connect', () => {
        console.log('Connected to music player WebSocket');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        resolve();
      });

      this.socket.on('disconnect', (reason) => {
        console.log('Disconnected from music player WebSocket:', reason);
        this.isConnected = false;

        if (reason === 'io server disconnect') {
          // Server disconnected, try to reconnect
          this.handleReconnect();
        }
      });

      this.socket.on('connect_error', (error) => {
        console.error('Music player WebSocket connection error:', error);
        this.isConnected = false;
        this.handleReconnect();
        reject(error);
      });

      this.socket.on('connection', (data) => {
        console.log('Music player WebSocket connection confirmed:', data);
      });
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }

  subscribeToTrack(trackId: string): void {
    if (!this.socket?.connected) {
      console.warn('Cannot subscribe to track: WebSocket not connected');
      return;
    }

    this.socket.emit('subscribe-track', { trackId });
  }

  unsubscribeFromTrack(trackId: string): void {
    if (!this.socket?.connected) {
      console.warn('Cannot unsubscribe from track: WebSocket not connected');
      return;
    }

    this.socket.emit('unsubscribe-track', { trackId });
  }

  onPlaybackStateUpdate(
    callback: (playbackState: PlaybackState) => void,
  ): void {
    if (!this.socket) return;

    this.socket.on('playback-state-update', (data) => {
      callback(data.data);
    });
  }

  onPlaybackStopped(callback: (trackId: string) => void): void {
    if (!this.socket) return;

    this.socket.on('playback-stopped', (data) => {
      callback(data.data.trackId);
    });
  }

  onSubscriptionConfirmed(callback: (trackId: string) => void): void {
    if (!this.socket) return;

    this.socket.on('subscription-confirmed', (data) => {
      callback(data.trackId);
    });
  }

  onUnsubscriptionConfirmed(callback: (trackId: string) => void): void {
    if (!this.socket) return;

    this.socket.on('unsubscription-confirmed', (data) => {
      callback(data.trackId);
    });
  }

  offPlaybackStateUpdate(
    callback?: (playbackState: PlaybackState) => void,
  ): void {
    if (!this.socket) return;

    if (callback) {
      this.socket.off('playback-state-update', callback);
    } else {
      this.socket.off('playback-state-update');
    }
  }

  offPlaybackStopped(callback?: (trackId: string) => void): void {
    if (!this.socket) return;

    if (callback) {
      this.socket.off('playback-stopped', callback);
    } else {
      this.socket.off('playback-stopped');
    }
  }

  offSubscriptionConfirmed(callback?: (trackId: string) => void): void {
    if (!this.socket) return;

    if (callback) {
      this.socket.off('subscription-confirmed', callback);
    } else {
      this.socket.off('subscription-confirmed');
    }
  }

  offUnsubscriptionConfirmed(callback?: (trackId: string) => void): void {
    if (!this.socket) return;

    if (callback) {
      this.socket.off('unsubscription-confirmed', callback);
    } else {
      this.socket.off('unsubscription-confirmed');
    }
  }

  get connected(): boolean {
    return this.isConnected && this.socket?.connected === true;
  }

  private handleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error(
        'Max reconnection attempts reached for music player WebSocket',
      );
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    console.log(
      `Attempting to reconnect to music player WebSocket in ${delay}ms (attempt ${this.reconnectAttempts})`,
    );

    setTimeout(() => {
      this.connect().catch((error) => {
        console.error('Failed to reconnect to music player WebSocket:', error);
      });
    }, delay);
  }
}

// Singleton instance
export const musicPlayerWebSocket = new MusicPlayerWebSocketService();
