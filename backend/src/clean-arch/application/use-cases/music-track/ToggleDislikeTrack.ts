import { Injectable } from '@nestjs/common';
import { MusicTrackId } from 'src/clean-arch/kernel/ids';
import { models } from 'src/clean-arch/kernel/types/models';
import { IHiddenMusicTrackRepository } from '../../ports/repositories/IHiddenMusicTrackRepository';
import { IMusicTrackRepository } from '../../ports/repositories/IMusicTrackRepository';

@Injectable()
export class ToggleDislikeUseCase {
  constructor(
    private readonly musicTrackRepository: IMusicTrackRepository,

    private readonly hiddenMusicTrackRepository: IHiddenMusicTrackRepository,
  ) {}

  async execute(id: MusicTrackId): Promise<boolean> {
    const track = await this.musicTrackRepository.getOneById(id);
    await this.hiddenMusicTrackRepository.save(
      models.hiddenMusicTrack.instantiateNew(track),
    );
    return this.musicTrackRepository.removeOneById(id);
  }
}
