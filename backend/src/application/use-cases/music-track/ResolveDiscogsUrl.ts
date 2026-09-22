import { Inject } from '@nestjs/common';
import {
  AUDIO_ANALYSIS_STRUCTURE,
  IAudioAnalysisStructure,
} from 'src/application/ports/infrastructure/IAudioAnalysisStructure';
import { ILogger, LOGGER } from 'src/application/ports/infrastructure/ILogger';
import { MusicTrackId } from 'src/kernel/ids';
import { IMusicTrackRepository } from '../../ports/repositories/IMusicTrackRepository';

export class ResolveDiscogsUrlUseCase {
  constructor(
    private readonly musicTrackRepository: IMusicTrackRepository,
    @Inject(AUDIO_ANALYSIS_STRUCTURE)
    private readonly audioAnalysisStructure: IAudioAnalysisStructure,
    @Inject(LOGGER)
    private readonly logger: ILogger,
  ) {}

  async execute(trackId: MusicTrackId): Promise<void> {
    const track = await this.musicTrackRepository.getOneById(trackId);
    if (track.discogsUrl) {
      this.logger.debug('Skipping Discogs lookup: already resolved', { trackId });
      return;
    }

    if (!track.artist || !track.title) {
      this.logger.warn('Skipping Discogs lookup: missing artist/title', {
        trackId,
        artist: track.artist,
        title: track.title,
      });
      return;
    }

    this.logger.debug('Resolving Discogs URL', { trackId, artist: track.artist, title: track.title });

    let discogsUrl: string | null;
    try {
      discogsUrl = await this.audioAnalysisStructure.resolveDiscogsUrl(track.artist, track.title);
    } catch (error) {
      this.logger.error('Discogs URL resolution failed', {
        trackId,
        artist: track.artist,
        title: track.title,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }

    if (!discogsUrl) {
      this.logger.warn('No Discogs match found', { trackId, artist: track.artist, title: track.title });
      return;
    }

    await this.musicTrackRepository.updateOneById(trackId, { discogsUrl });
    this.logger.info('Discogs URL resolved', { trackId, discogsUrl });
  }
}
