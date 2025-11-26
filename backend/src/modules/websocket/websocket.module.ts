import { Module } from '@nestjs/common';
import { QueueModule } from '../queue/queue.module';
import { MusicPlayerWebSocketGateway } from './music-player-websocket.gateway';
import { ProgressWebSocketGateway } from './progress-websocket.gateway';

@Module({
  imports: [QueueModule],
  providers: [ProgressWebSocketGateway, MusicPlayerWebSocketGateway],
  exports: [ProgressWebSocketGateway, MusicPlayerWebSocketGateway],
})
export class WebSocketModule {}
