import { MusicTrackId } from 'src/clean-arch/kernel/ids';
import { models } from 'src/clean-arch/kernel/types/models';
import { IHiddenMusicTrackRepository } from '../../ports/repositories/IHiddenMusicTrackRepository';
import { IMusicTrackRepository } from '../../ports/repositories/IMusicTrackRepository';

export class ToggleDislikeUseCase {
  constructor(
    private readonly musicTrackRepository: IMusicTrackRepository,

    private readonly hiddenMusicTrackRepository: IHiddenMusicTrackRepository,
  ) {}

  async execute(id: MusicTrackId): Promise<boolean> {
    const track = await this.musicTrackRepository.getOneById(id);
    await this.hiddenMusicTrackRepository.save(
      models.hiddenMusicTrack.instantiateNew({
        ...track,
        artist: track.artist,
        title: track.title,
        imagePath: track.imagePath,
        libraryId: track.libraryId,
        fileInfo: track.fileInfo,
        technicalInfo: track.technicalInfo,
        aiMetadata: track.aiMetadata,
      }),
    );
    return this.musicTrackRepository.removeOneById(id);
  }
}
