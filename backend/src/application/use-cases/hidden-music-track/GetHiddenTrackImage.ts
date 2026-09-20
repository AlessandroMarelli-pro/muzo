import { HiddenMusicTrackId } from 'src/kernel/ids';
import {
  HiddenTrackImage,
  IHiddenMusicTrackRepository,
} from '../../ports/repositories/IHiddenMusicTrackRepository';

export class GetHiddenTrackImageUseCase {
  constructor(private readonly hiddenMusicTrackRepository: IHiddenMusicTrackRepository) {}

  async execute(id: HiddenMusicTrackId): Promise<HiddenTrackImage | null> {
    return this.hiddenMusicTrackRepository.findImageById(id);
  }
}
