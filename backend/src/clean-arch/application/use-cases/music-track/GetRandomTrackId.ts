import { Injectable } from '@nestjs/common';
import { MusicTrackId } from 'src/clean-arch/kernel/ids';
import { IMusicTrackRepository } from '../../ports/repositories/IMusicTrackRepository';

@Injectable()
export class GetRandomTrackIdUseCase {
  constructor(private readonly musicTrackRepository: IMusicTrackRepository) {}

  async execute(): Promise<MusicTrackId> {
    return this.musicTrackRepository.getRandomTrackId();
  }
}
