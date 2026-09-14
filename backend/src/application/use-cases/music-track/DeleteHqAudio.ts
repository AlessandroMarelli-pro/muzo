import * as fs from 'fs/promises';
import { MusicTrackId } from 'src/kernel/ids';
import { IMusicTrackRepository } from '../../ports/repositories/IMusicTrackRepository';

export class DeleteHqAudioUseCase {
  constructor(private readonly musicTrackRepository: IMusicTrackRepository) {}

  async execute(id: MusicTrackId): Promise<boolean> {
    const track = await this.musicTrackRepository.getOneById(id);
    if (track.hqAudioPath) {
      await fs.unlink(track.hqAudioPath).catch(() => undefined);
    }
    await this.musicTrackRepository.updateOneById(id, {
      hqAudioPath: null,
      hqAudioSource: null,
      hqAudioVerified: false,
      hqAudioSpectralCutoffHz: null,
    });
    return true;
  }
}
