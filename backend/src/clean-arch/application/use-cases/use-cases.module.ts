import { Module } from '@nestjs/common';
import { RepositoriesModule } from '../../adaptaters/persistence/repositories/repositories.module';
import { CreatePlaylistUseCase } from './playlist/CreatePlaylist';
import { GetPlaylistsUseCase } from './playlist/GetPlaylists';

@Module({
  imports: [RepositoriesModule],
  providers: [CreatePlaylistUseCase, GetPlaylistsUseCase],
  exports: [CreatePlaylistUseCase, GetPlaylistsUseCase],
})
export class UseCasesModule {}
