import { PlaylistId } from 'src/kernel/ids';
import { IPlaylistRepository } from '../../ports/repositories/IPlaylistRepository';
import { IPlaylistSortingRepository } from '../../ports/repositories/IPlaylistSortingRepository';

export class ExportPlaylistToM3UUseCase {
  constructor(
    private readonly playlistRepository: IPlaylistRepository,

    private readonly playlistSortingRepository: IPlaylistSortingRepository,
  ) {}

  async execute(playlistId: PlaylistId): Promise<string> {
    const sorting = await this.playlistSortingRepository.getByPlaylistId(playlistId);
    const playlist = await this.playlistRepository.getOneByIdWithTracks(playlistId, sorting);

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
