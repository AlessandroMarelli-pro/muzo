import { Module } from '@nestjs/common';
import { RepositoriesModule } from '../../adapters/persistence/repositories/repositories.module';
import {
  AddTrackToPlaylistUseCase,
  CreatePlaylistUseCase,
  DeletePlaylistUseCase,
  ExportPlaylistToM3UUseCase,
  GetFavoriteUseCase,
  GetPlaylistSortingByPlaylistIdUseCase,
  GetPlaylistsStatsUseCase,
  GetPlaylistStatsUseCase,
  GetPlaylistsUseCase,
  GetPlaylistTracksUseCase,
  GetPlaylistTracksWithDetailUseCase,
  GetPlaylistUseCase,
  RemoveTrackFromPlaylistUseCase,
  UpdatePlaylistTracksPositionsUseCase,
  UpdatePlaylistUseCase,
} from './';
import { UpdatePlaylistSortingUseCase } from './playlist-sorting/UpdatePlaylistSorting';
import { GetStaticFilterOptionsUseCase } from './saved-filter';

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
    ExportPlaylistToM3UUseCase,
    UpdatePlaylistSortingUseCase,
    UpdatePlaylistTracksPositionsUseCase,
    GetStaticFilterOptionsUseCase,
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
    ExportPlaylistToM3UUseCase,
    UpdatePlaylistSortingUseCase,
    UpdatePlaylistTracksPositionsUseCase,
    GetStaticFilterOptionsUseCase,
  ],
})
export class UseCasesModule {}
