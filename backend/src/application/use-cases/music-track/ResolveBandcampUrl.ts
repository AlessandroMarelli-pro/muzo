import { Inject } from '@nestjs/common';
import {
  AUDIO_ANALYSIS_STRUCTURE,
  IAudioAnalysisStructure,
} from 'src/application/ports/infrastructure/IAudioAnalysisStructure';
import { ILogger, LOGGER } from 'src/application/ports/infrastructure/ILogger';
import { MusicTrackId } from 'src/kernel/ids';
import { IMusicTrackRepository } from '../../ports/repositories/IMusicTrackRepository';

export class ResolveBandcampUrlUseCase {
  constructor(
    private readonly musicTrackRepository: IMusicTrackRepository,
    @Inject(AUDIO_ANALYSIS_STRUCTURE)
    private readonly audioAnalysisStructure: IAudioAnalysisStructure,
    @Inject(LOGGER)
    private readonly logger: ILogger,
  ) {}

  async execute(trackId: MusicTrackId): Promise<void> {
    const track = await this.musicTrackRepository.getOneById(trackId);
    if (track.bandcampUrl) {
      return;
    }

    if (!track.artist || !track.title) {
      this.logger.warn('Skipping Bandcamp lookup: missing artist/title', {
        trackId,
        artist: track.artist,
        title: track.title,
      });
      return;
    }

    const bandcampUrl = await this.audioAnalysisStructure.resolveBandcampUrl(
      track.artist,
      track.title,
    );

    if (!bandcampUrl) {
      this.logger.warn('No Bandcamp match found', { trackId, artist: track.artist, title: track.title });
      return;
    }

    await this.musicTrackRepository.updateOneById(trackId, { bandcampUrl });
  }
}
