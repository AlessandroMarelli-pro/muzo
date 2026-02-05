import { Inject, Injectable } from '@nestjs/common';
import { MusicTrackId } from 'src/clean-arch/kernel/ids';
import { models } from 'src/clean-arch/kernel/types/models';
import {
  HIDDEN_MUSIC_TRACK_REPOSITORY,
  IHiddenMusicTrackRepository,
} from '../../ports/repositories/IHiddenMusicTrackRepository';
import {
  IMusicTrackRepository,
  MUSIC_TRACK_REPOSITORY,
} from '../../ports/repositories/IMusicTrackRepository';

@Injectable()
export class ToggleDislikeUseCase {
  constructor(
    @Inject(MUSIC_TRACK_REPOSITORY)
    private readonly musicTrackRepository: IMusicTrackRepository,
    @Inject(HIDDEN_MUSIC_TRACK_REPOSITORY)
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
