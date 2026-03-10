import { MusicTrackId } from 'src/kernel/ids';
import { Maybe } from 'src/kernel/types';
import { IMusicTrackRepository } from '../../ports/repositories/IMusicTrackRepository';

export class GetRandomTrackIdUseCase {
  constructor(private readonly musicTrackRepository: IMusicTrackRepository) {}

  async execute(): Promise<Maybe<MusicTrackId>> {
    let id = null;
    try {
      id = await this.musicTrackRepository.getRandomTrackId();
    } catch (error) {}
    return id;
  }
}
