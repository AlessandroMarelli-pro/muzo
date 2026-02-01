import { Inject, Injectable } from '@nestjs/common';
import { PlaylistId } from 'src/clean-arch/kernel/ids';
import {
  IPlaylistRepository,
  PLAYLIST_REPOSITORY,
} from '../../ports/repositories/IPlaylistRepository';
import {
  IPlaylistSortingRepository,
  PLAYLIST_SORTING_REPOSITORY,
} from '../../ports/repositories/IPlaylistSortingRepository';

@Injectable()
export class ExportPlaylistToM3UUseCase {
  constructor(
    @Inject(PLAYLIST_REPOSITORY)
    private readonly playlistRepository: IPlaylistRepository,
    @Inject(PLAYLIST_SORTING_REPOSITORY)
    private readonly playlistSortingRepository: IPlaylistSortingRepository,
  ) {}

  async execute(playlistId: PlaylistId): Promise<string> {
    const sorting =
      await this.playlistSortingRepository.getByPlaylistId(playlistId);
    const playlist = await this.playlistRepository.getOneByIdWithTracks(
      playlistId,
      sorting,
    );

    // Start with M3U header
    let m3uContent = '#EXTM3U\n';

    // Add each track
    for (const playlistTrack of playlist.tracks) {
      const track = playlistTrack.track;
      const duration = Math.floor(track?.technicalInfo?.duration || 0);
      const displayName = `${track.artist} - ${track.title}`;
      // Add EXTINF line with duration and display name
      m3uContent += `#EXTINF:${duration},${displayName}\n`;
      // Add file path (absolute path)
      m3uContent += `${track?.fileInfo?.filePath || ''}\n`;
    }

    return m3uContent;
  }
}
