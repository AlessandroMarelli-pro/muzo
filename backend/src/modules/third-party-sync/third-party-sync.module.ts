import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PlaylistModule } from '../playlist/playlist.module';
import { PrismaService } from '../../shared/services/prisma.service';
import { ThirdPartySyncResolver } from './third-party-sync.resolver';
import { ThirdPartySyncService } from './third-party-sync.service';
import { YoutubeService } from './services/youtube.service';
import { Id3ReaderService } from './utils/id3-reader.service';

@Module({
  imports: [ConfigModule, PlaylistModule],
  providers: [
    ThirdPartySyncService,
    ThirdPartySyncResolver,
    YoutubeService,
    Id3ReaderService,
    PrismaService,
  ],
  exports: [ThirdPartySyncService],
})
export class ThirdPartySyncModule {}
