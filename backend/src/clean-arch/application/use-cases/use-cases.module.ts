import { Module } from '@nestjs/common';
import { RepositoriesModule } from '../../adapters/persistence/repositories/repositories.module';
import {
  CreatePlaylistUseCase,
  DeletePlaylistUseCase,
  GetPlaylistSortingByPlaylistIdUseCase,
  GetPlaylistsStatsUseCase,
  GetPlaylistStatsUseCase,
  GetPlaylistsUseCase,
  GetPlaylistTracksUseCase,
  GetPlaylistTracksWithDetailUseCase,
  GetPlaylistUseCase,
  UpdatePlaylistUseCase,
} from './';

@Module({
  imports: [RepositoriesModule],
  providers: [
    CreatePlaylistUseCase,
    GetPlaylistsUseCase,
    GetPlaylistUseCase,
    UpdatePlaylistUseCase,
    DeletePlaylistUseCase,
    GetPlaylistStatsUseCase,
    GetPlaylistTracksUseCase,
    GetPlaylistsStatsUseCase,
    GetPlaylistSortingByPlaylistIdUseCase,
    GetPlaylistTracksWithDetailUseCase,
  ],
  exports: [
    CreatePlaylistUseCase,
    GetPlaylistsUseCase,
    GetPlaylistUseCase,
    UpdatePlaylistUseCase,
    DeletePlaylistUseCase,
    GetPlaylistStatsUseCase,
    GetPlaylistTracksUseCase,
    GetPlaylistsStatsUseCase,
    GetPlaylistSortingByPlaylistIdUseCase,
    GetPlaylistTracksWithDetailUseCase,
  ],
})
export class UseCasesModule {}
