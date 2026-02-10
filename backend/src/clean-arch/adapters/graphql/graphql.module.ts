import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { UseCasesModule } from 'src/clean-arch/application/use-cases/use-cases.module';
import { AuthGuard } from './context/auth.guard';
import { DomainErrorExceptionFilter } from './filters/domain-error.exception-filter';
import { MusicLibraryResolver } from './resolvers/music-library.resolver';
import { MusicPlayerResolver } from './resolvers/music-player.resolver';
import { MusicTrackResolver } from './resolvers/music-track.resolver';
import { NodeResolver } from './resolvers/node.resolver';
import { PlaybackQueueResolver } from './resolvers/playback-queue.resolver';
import { PlaylistTrackResolver } from './resolvers/playlist-track.resolver';
import { CleanArchPlaylistResolver } from './resolvers/playlist.resolver';
import { SavedFilterResolver } from './resolvers/saved-filter.resolver';
import { ThirdPartySyncResolver } from './resolvers/third-party-sync.resolver';
import { UserResolver } from './resolvers/user.resolver';
import { Base64ID } from './scalars/base64-id.scalar';

@Module({
  imports: [UseCasesModule],
  providers: [
    CleanArchPlaylistResolver,
    NodeResolver,
    UserResolver,
    Base64ID,
    AuthGuard,
    PlaylistTrackResolver,
    PlaybackQueueResolver,
    SavedFilterResolver,
    MusicPlayerResolver,
    MusicTrackResolver,
    MusicLibraryResolver,
    ThirdPartySyncResolver,
    {
      provide: APP_FILTER,
      useClass: DomainErrorExceptionFilter,
    },
  ],
})
export class CleanArchGraphQLModule {}
