import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { MusicTrackId } from 'src/clean-arch/kernel/ids';
import {
  AUDIO_WAVEFORM_GENERATOR,
  IAudioWaveformGenerator,
} from '../../ports/infrastructure/IAudioWaveformGenerator';
import {
  IMusicTrackRepository,
  MUSIC_TRACK_REPOSITORY,
} from '../../ports/repositories/IMusicTrackRepository';

@Injectable()
export class GetWaveformDataUseCase {
  constructor(
    @Inject(AUDIO_WAVEFORM_GENERATOR)
    private readonly audioWaveformGenerator: IAudioWaveformGenerator,
    @Inject(MUSIC_TRACK_REPOSITORY)
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
