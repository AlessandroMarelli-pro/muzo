import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from '../../shared/services/prisma.service';
import { OAuthRedirectController } from './oauth-redirect.controller';
import { SpotifyService } from './services/spotify.service';
import { TidalService } from './services/tidal.service';
import { YoutubeService } from './services/youtube.service';
import { ThirdPartySyncResolver } from './third-party-sync.resolver';
import { ThirdPartySyncService } from './third-party-sync.service';
import { Id3ReaderService } from './utils/id3-reader.service';

@Module({
  imports: [ConfigModule],
  controllers: [OAuthRedirectController],
  providers: [
    ThirdPartySyncService,
    ThirdPartySyncResolver,
    YoutubeService,
    TidalService,
    SpotifyService,
    Id3ReaderService,
    PrismaService,
  ],
  exports: [ThirdPartySyncService],
})
export class ThirdPartySyncModule {}
