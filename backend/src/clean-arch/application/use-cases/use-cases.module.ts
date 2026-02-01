import { Module } from '@nestjs/common';
import { RepositoriesModule } from '../../adapters/persistence/repositories/repositories.module';
import {
  AddTrackToPlaylistUseCase,
  CreatePlaylistUseCase,
  DeletePlaylistUseCase,
  GetFavoriteUseCase,
  GetPlaylistSortingByPlaylistIdUseCase,
  GetPlaylistsStatsUseCase,
  GetPlaylistStatsUseCase,
  GetPlaylistsUseCase,
  GetPlaylistTracksUseCase,
  GetPlaylistTracksWithDetailUseCase,
  GetPlaylistUseCase,
  RemoveTrackFromPlaylistUseCase,
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
    GetFavoriteUseCase,
    AddTrackToPlaylistUseCase,
    RemoveTrackFromPlaylistUseCase,
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
    GetFavoriteUseCase,
    AddTrackToPlaylistUseCase,
    RemoveTrackFromPlaylistUseCase,
  ],
})
export class UseCasesModule {}
