import { Module } from '@nestjs/common';
import { RepositoriesModule } from '../../adapters/persistence/repositories/repositories.module';
import {
  CreatePlaylistUseCase,
  DeletePlaylistUseCase,
  GetPlaylistsUseCase,
  GetPlaylistUseCase,
  UpdatePlaylistUseCase,
} from './playlist/';

@Module({
  imports: [RepositoriesModule],
  providers: [
    CreatePlaylistUseCase,
    GetPlaylistsUseCase,
    GetPlaylistUseCase,
    UpdatePlaylistUseCase,
    DeletePlaylistUseCase,
  ],
  exports: [
    CreatePlaylistUseCase,
    GetPlaylistsUseCase,
    GetPlaylistUseCase,
    UpdatePlaylistUseCase,
    DeletePlaylistUseCase,
  ],
})
export class UseCasesModule {}
