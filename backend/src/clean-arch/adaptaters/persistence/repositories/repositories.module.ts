import { Module } from '@nestjs/common';

import { PLAYLIST_REPOSITORY } from 'src/clean-arch/application/ports/repositories/IPlaylistRepository';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { PlaylistRepository } from './playlist/playlist.repository';

@Module({
  providers: [
    PlaylistRepository,
    PrismaService,
    { provide: PLAYLIST_REPOSITORY, useClass: PlaylistRepository },
  ],
  exports: [PlaylistRepository, PLAYLIST_REPOSITORY],
})
export class RepositoriesModule {}
