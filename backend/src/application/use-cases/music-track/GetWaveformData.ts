import { NotFoundException } from '@nestjs/common';
import { MusicTrackId } from 'src/kernel/ids';
import { IAudioWaveformGenerator } from '../../ports/infrastructure/IAudioWaveformGenerator';
import { IMusicTrackRepository } from '../../ports/repositories/IMusicTrackRepository';

export class GetWaveformDataUseCase {
  constructor(
    private readonly audioWaveformGenerator: IAudioWaveformGenerator,

    private readonly musicTrackRepository: IMusicTrackRepository,
  ) {}

  async execute(trackId: MusicTrackId): Promise<number[]> {
    const track = await this.musicTrackRepository.getOneById(trackId);
    if (!track) {
      throw new NotFoundException(`Track with ID ${trackId} not found`);
    }
    const filePath = track.fileInfo.filePath;
    return this.audioWaveformGenerator.generateWaveform(filePath);
  }
}
