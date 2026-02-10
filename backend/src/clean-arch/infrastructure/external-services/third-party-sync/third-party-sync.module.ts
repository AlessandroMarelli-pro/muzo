import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SPOTIFY_SYNC_PROVIDER } from 'src/clean-arch/application/ports/infrastructure/ISpotifySyncProvider';
import { TIDAL_SYNC_PROVIDER } from 'src/clean-arch/application/ports/infrastructure/ITidalSyncProvider';
import { YOUTUBE_SYNC_PROVIDER } from 'src/clean-arch/application/ports/infrastructure/IYouTubeSyncProvider';
import { AdaptersPersistenceModule } from 'src/clean-arch/adapters/persistence/persistence.module';
import { SpotifySyncAdapter } from './spotify-sync.adapter';
import { TidalSyncAdapter } from './tidal-sync.adapter';
import { YoutubeSyncAdapter } from './youtube-sync.adapter';

@Module({
  imports: [ConfigModule, AdaptersPersistenceModule],
  providers: [
    { provide: YOUTUBE_SYNC_PROVIDER, useClass: YoutubeSyncAdapter },
    { provide: TIDAL_SYNC_PROVIDER, useClass: TidalSyncAdapter },
    { provide: SPOTIFY_SYNC_PROVIDER, useClass: SpotifySyncAdapter },
  ],
  exports: [YOUTUBE_SYNC_PROVIDER, TIDAL_SYNC_PROVIDER, SPOTIFY_SYNC_PROVIDER],
})
export class ThirdPartySyncInfrastructureModule {}
