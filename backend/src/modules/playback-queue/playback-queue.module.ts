import { Module } from '@nestjs/common';
import { PrismaService } from '../../shared/services/prisma.service';
import { PlaybackQueueResolver } from './playback-queue.resolver';
import { PlaybackQueueService } from './playback-queue.service';

@Module({
  providers: [PlaybackQueueService, PlaybackQueueResolver, PrismaService],
  exports: [PlaybackQueueService],
})
export class PlaybackQueueModule {}
