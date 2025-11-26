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
import { ProgressTrackingService } from '../queue/progress-tracking.service';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class ProgressWebSocketGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ProgressWebSocketGateway.name);
  private clients: Map<string, Socket> = new Map();

  constructor(
    private readonly progressTrackingService: ProgressTrackingService,
  ) {
    // Subscribe to progress updates and broadcast them to connected clients
    this.progressTrackingService.getProgressStream().subscribe((progress) => {
      this.broadcastProgressUpdate(progress);
    });
  }

  handleConnection(client: Socket) {
    const clientId = this.generateClientId();
    this.clients.set(clientId, client);
    this.logger.log(`Client connected: ${clientId}`);

    // Send welcome message
    client.emit('connection', {
      type: 'connection',
      message: 'Connected to progress updates',
      clientId,
    });
  }

  handleDisconnect(client: Socket) {
    // Find and remove the client
    for (const [clientId, socket] of this.clients.entries()) {
      if (socket === client) {
        this.clients.delete(clientId);
        this.logger.log(`Client disconnected: ${clientId}`);
        break;
      }
    }
  }

  @SubscribeMessage('subscribe-library-progress')
  handleSubscribeLibraryProgress(
    @MessageBody() data: { libraryId?: string },
    @ConnectedSocket() client: Socket,
  ) {
    this.logger.log(
      `Client subscribed to library progress: ${data.libraryId || 'all'}`,
    );

    client.emit('subscription-confirmed', {
      type: 'subscription-confirmed',
      message: `Subscribed to library progress updates${data.libraryId ? ` for library ${data.libraryId}` : ' for all libraries'}`,
    });
  }

  private broadcastProgressUpdate(progress: any) {
    const message = {
      type: 'library-scan-progress',
      data: progress,
    };

    this.clients.forEach((client, clientId) => {
      if (client.connected) {
        try {
          client.emit('library-scan-progress', message);
        } catch (error) {
          this.logger.error(
            `Failed to send message to client ${clientId}:`,
            error,
          );
          this.clients.delete(clientId);
        }
      }
    });
  }

  private generateClientId(): string {
    return Math.random().toString(36).substring(2, 15);
  }
}
