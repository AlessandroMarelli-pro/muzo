import { MusicTrackId } from 'src/kernel/ids';
import { IMusicTrackRepository } from '../../ports/repositories/IMusicTrackRepository';

export class GetRandomTrackIdUseCase {
  constructor(private readonly musicTrackRepository: IMusicTrackRepository) {}

  async execute(): Promise<MusicTrackId> {
    return this.musicTrackRepository.getRandomTrackId();
  }
}
