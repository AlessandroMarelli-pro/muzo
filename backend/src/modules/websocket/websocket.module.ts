import { Module } from '@nestjs/common';
import { QueueModule } from '../queue/queue.module';
import { ProgressWebSocketGateway } from './progress-websocket.gateway';

@Module({
  imports: [QueueModule],
  providers: [ProgressWebSocketGateway],
  exports: [ProgressWebSocketGateway],
})
export class WebSocketModule {}
