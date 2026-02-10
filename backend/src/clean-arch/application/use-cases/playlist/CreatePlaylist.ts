import { ILogger } from 'src/clean-arch/application/ports/infrastructure/ILogger';
import {
  FilterCriteria,
  Playlist,
} from 'src/clean-arch/kernel/types/model-types';
import { models } from 'src/clean-arch/kernel/types/models';
import { IMusicTrackRepository } from '../../ports/repositories/IMusicTrackRepository';
import { IPlaylistRepository } from '../../ports/repositories/IPlaylistRepository';
import { IPlaylistSortingRepository } from '../../ports/repositories/IPlaylistSortingRepository';
import { IPlaylistTrackRepository } from '../../ports/repositories/IPlaylistTrackRepository';
import { CreatePlaylistInput } from './CreatePlaylist.input';

export class CreatePlaylistUseCase {
  constructor(
    private readonly playlistRepository: IPlaylistRepository,
    private readonly musicTrackRepository: IMusicTrackRepository,
    private readonly playlistTrackRepository: IPlaylistTrackRepository,
    private readonly playlistSortingRepository: IPlaylistSortingRepository,
    private readonly logger: ILogger,
  ) {}

  async execute(createPlaylistInput: CreatePlaylistInput): Promise<Playlist> {
    this.logger.info('Creating playlist', { createPlaylistInput });
    const { filters, maxTracks, subgenreSelectionMode } = createPlaylistInput;

    const playlistData = models.playlist.instantiateNew({
      name: createPlaylistInput.name,
      isPublic: createPlaylistInput.isPublic ?? false,
      description: createPlaylistInput.description ?? null,
      isFavorite: false,
    });
    const playlist = await this.playlistRepository.save(playlistData);
    // If filters are provided, find and add matching tracks
    if (
      filters &&
      (filters.genreIds?.length ||
        filters.subgenreIds?.length ||
        filters.atmospheres?.length ||
        filters.libraryIds?.length ||
        (filters.tempo &&
          (filters.tempo.min !== undefined || filters.tempo.max !== undefined)))
    ) {
      const filterCriteria: FilterCriteria = {
        genreIds: filters.genreIds,
        subgenreIds: filters.subgenreIds,
        keyIds: [],
        atmosphereIds: filters.atmospheres,
        libraryIds: filters.libraryIds,
        tempo: filters.tempo,
        valenceMood: [],
        arousalMood: [],
        danceabilityFeeling: [],
        speechiness: { min: 0, max: 1 },
        instrumentalness: { min: 0, max: 1 },
        liveness: { min: 0, max: 1 },
        acousticness: { min: 0, max: 1 },
        artist: null,
        title: null,
      };
      const tracks = await this.musicTrackRepository.getManyByCriteria(
        filterCriteria,
        subgenreSelectionMode || 'exact',
        {
          limit: maxTracks || 100,
          offset: 0,
          orderBy: 'fileCreatedAt',
          orderDirection: 'desc',
        },
        false,
      );
      this.logger.info('Found tracks', { tracks: tracks.length });
      // Add tracks to playlist
      if (tracks.length > 0) {
        await this.playlistTrackRepository.saveMany(
          tracks.map((track, index) =>
            models.playlistTrack.instantiateNew({
              playlistId: playlist.id,
              trackId: track.id,
              position: index + 1,
              addedAt: new Date(),
            }),
          ),
        );
      }
      this.logger.info('Saved playlist tracks', { playlistId: playlist.id });
    }
    this.logger.info('Saving playlist sorting', { playlistId: playlist.id });
    await this.playlistSortingRepository.save(
      models.playlistSorting.instantiateNew({
        playlistId: playlist.id,
        sortingKey: 'position',
        sortingDirection: 'asc',
      }),
    );
    this.logger.info('Saved playlist sorting', { playlistId: playlist.id });
    return playlist;
  }
}
