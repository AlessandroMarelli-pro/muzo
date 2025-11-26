import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PlaybackState } from '../music-player/music-player.types';

@WebSocketGateway({
  namespace: '/music-player',
  cors: {
    origin: '*',
  },
})
export class MusicPlayerWebSocketGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(MusicPlayerWebSocketGateway.name);
  private clients: Map<string, Socket> = new Map();
  private trackSubscriptions: Map<string, Set<string>> = new Map(); // trackId -> Set of clientIds

  handleConnection(client: Socket) {
    const clientId = this.generateClientId();
    this.clients.set(clientId, client);
    this.logger.log(`Music player client connected: ${clientId}`);

    client.emit('connection', {
      type: 'connection',
      message: 'Connected to music player updates',
      clientId,
    });
  }

  handleDisconnect(client: Socket) {
    // Find and remove the client
    for (const [clientId, socket] of this.clients.entries()) {
      if (socket === client) {
        this.clients.delete(clientId);

        // Remove client from all track subscriptions
        this.trackSubscriptions.forEach((clientSet, trackId) => {
          clientSet.delete(clientId);
          if (clientSet.size === 0) {
            this.trackSubscriptions.delete(trackId);
          }
        });

        this.logger.log(`Music player client disconnected: ${clientId}`);
        break;
      }
    }
  }

  @SubscribeMessage('subscribe-track')
  handleSubscribeTrack(
    @MessageBody() data: { trackId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const clientId = this.getClientId(client);
    if (!clientId) return;

    const { trackId } = data;

    if (!this.trackSubscriptions.has(trackId)) {
      this.trackSubscriptions.set(trackId, new Set());
    }

    this.trackSubscriptions.get(trackId)!.add(clientId);

    this.logger.log(`Client ${clientId} subscribed to track ${trackId}`);

    client.emit('subscription-confirmed', {
      type: 'subscription-confirmed',
      message: `Subscribed to track ${trackId} updates`,
      trackId,
    });
  }

  @SubscribeMessage('unsubscribe-track')
  handleUnsubscribeTrack(
    @MessageBody() data: { trackId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const clientId = this.getClientId(client);
    if (!clientId) return;

    const { trackId } = data;
    const clientSet = this.trackSubscriptions.get(trackId);

    if (clientSet) {
      clientSet.delete(clientId);
      if (clientSet.size === 0) {
        this.trackSubscriptions.delete(trackId);
      }
    }

    this.logger.log(`Client ${clientId} unsubscribed from track ${trackId}`);

    client.emit('unsubscription-confirmed', {
      type: 'unsubscription-confirmed',
      message: `Unsubscribed from track ${trackId} updates`,
      trackId,
    });
  }

  broadcastPlaybackStateUpdate(playbackState: PlaybackState) {
    const message = {
      type: 'playback-state-update',
      data: playbackState,
    };

    const clientSet = this.trackSubscriptions.get(playbackState.trackId);
    if (!clientSet) return;

    clientSet.forEach((clientId) => {
      const client = this.clients.get(clientId);
      if (client && client.connected) {
        try {
          client.emit('playback-state-update', message);
        } catch (error) {
          this.logger.error(
            `Failed to send playback state to client ${clientId}:`,
            error,
          );
          this.clients.delete(clientId);
          clientSet.delete(clientId);
        }
      } else {
        clientSet.delete(clientId);
      }
    });
  }

  broadcastPlaybackStopped(trackId: string) {
    const message = {
      type: 'playback-stopped',
      data: { trackId },
    };

    const clientSet = this.trackSubscriptions.get(trackId);
    if (!clientSet) return;

    clientSet.forEach((clientId) => {
      const client = this.clients.get(clientId);
      if (client && client.connected) {
        try {
          client.emit('playback-stopped', message);
        } catch (error) {
          this.logger.error(
            `Failed to send playback stopped to client ${clientId}:`,
            error,
          );
          this.clients.delete(clientId);
          clientSet.delete(clientId);
        }
      } else {
        clientSet.delete(clientId);
      }
    });
  }

  private getClientId(client: Socket): string | null {
    for (const [clientId, socket] of this.clients.entries()) {
      if (socket === client) {
        return clientId;
      }
    }
    return null;
  }

  private generateClientId(): string {
    return Math.random().toString(36).substring(2, 15);
  }
}
