import { ILogger } from 'src/application/ports/infrastructure/ILogger';
import { PlaylistId } from 'src/kernel/ids';
import { Playlist } from 'src/kernel/types/model-types';
import { models } from 'src/kernel/types/models';
import { IPlaylistRepository } from '../../ports/repositories/IPlaylistRepository';
import { IPlaylistSortingRepository } from '../../ports/repositories/IPlaylistSortingRepository';
import { IPlaylistTrackRepository } from '../../ports/repositories/IPlaylistTrackRepository';

export class DuplicatePlaylistUseCase {
  constructor(
    private readonly playlistRepository: IPlaylistRepository,
    private readonly playlistTrackRepository: IPlaylistTrackRepository,
    private readonly playlistSortingRepository: IPlaylistSortingRepository,
    private readonly logger: ILogger,
  ) {}

  async execute(id: PlaylistId): Promise<Playlist> {
    this.logger.info('Duplicating playlist', { id });

    const source = await this.playlistRepository.getOneById(id);
    const sourceTracks = await this.playlistTrackRepository.getTracksByPlaylistId(id);

    const playlistData = models.playlist.instantiateNew({
      name: `${source.name} copy`,
      description: source.description,
      isPublic: source.isPublic,
      isFavorite: false,
    });
    const playlist = await this.playlistRepository.save(playlistData);

    if (sourceTracks.length > 0) {
      const orderedTracks = [...sourceTracks].sort((a, b) => a.position - b.position);
      await this.playlistTrackRepository.saveMany(
        orderedTracks.map((playlistTrack, index) =>
          models.playlistTrack.instantiateNew({
            playlistId: playlist.id,
            trackId: playlistTrack.trackId,
            position: index + 1,
            addedAt: new Date(),
          }),
        ),
      );
    }

    await this.playlistSortingRepository.save(
      models.playlistSorting.instantiateNew({
        playlistId: playlist.id,
        sortingKey: 'position',
        sortingDirection: 'asc',
      }),
    );

    this.logger.info('Duplicated playlist', { sourceId: id, newId: playlist.id });
    return playlist;
  }
}
