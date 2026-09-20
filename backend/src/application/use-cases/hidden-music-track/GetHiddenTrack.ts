import { HiddenMusicTrackId } from 'src/kernel/ids';
import { HiddenMusicTrack } from 'src/kernel/types/model-types';
import { IHiddenMusicTrackRepository } from '../../ports/repositories/IHiddenMusicTrackRepository';

export class GetHiddenTrackUseCase {
  constructor(private readonly hiddenMusicTrackRepository: IHiddenMusicTrackRepository) {}

  async execute(id: HiddenMusicTrackId): Promise<HiddenMusicTrack> {
    return this.hiddenMusicTrackRepository.getOneById(id);
  }
}
