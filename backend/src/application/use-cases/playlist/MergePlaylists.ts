import { ILogger } from 'src/application/ports/infrastructure/ILogger';
import { PlaylistId } from 'src/kernel/ids';
import { Playlist } from 'src/kernel/types/model-types';
import { models } from 'src/kernel/types/models';
import { IPlaylistRepository } from '../../ports/repositories/IPlaylistRepository';
import { IPlaylistSortingRepository } from '../../ports/repositories/IPlaylistSortingRepository';
import { IPlaylistTrackRepository } from '../../ports/repositories/IPlaylistTrackRepository';

export class MergePlaylistsUseCase {
  constructor(
    private readonly playlistRepository: IPlaylistRepository,
    private readonly playlistTrackRepository: IPlaylistTrackRepository,
    private readonly playlistSortingRepository: IPlaylistSortingRepository,
    private readonly logger: ILogger,
  ) {}

  async execute(sourceIdA: PlaylistId, sourceIdB: PlaylistId, name: string): Promise<Playlist> {
    this.logger.info('Merging playlists', { sourceIdA, sourceIdB });

    const [tracksA, tracksB] = await Promise.all([
      this.playlistTrackRepository.getTracksByPlaylistId(sourceIdA),
      this.playlistTrackRepository.getTracksByPlaylistId(sourceIdB),
    ]);

    const orderedTracks = [
      ...[...tracksA].sort((a, b) => a.position - b.position),
      ...[...tracksB].sort((a, b) => a.position - b.position),
    ];

    const seenTrackIds = new Set<string>();
    const dedupedTracks = orderedTracks.filter((playlistTrack) => {
      if (seenTrackIds.has(playlistTrack.trackId)) {
        return false;
      }
      seenTrackIds.add(playlistTrack.trackId);
      return true;
    });

    const playlistData = models.playlist.instantiateNew({
      name,
      description: null,
      isPublic: false,
      isFavorite: false,
    });
    const playlist = await this.playlistRepository.save(playlistData);

    if (dedupedTracks.length > 0) {
      await this.playlistTrackRepository.saveMany(
        dedupedTracks.map((playlistTrack, index) =>
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

    this.logger.info('Merged playlists', { sourceIdA, sourceIdB, newId: playlist.id });
    return playlist;
  }
}
