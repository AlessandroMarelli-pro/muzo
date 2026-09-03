import { Inject } from '@nestjs/common';
import {
  HQ_AUDIO_ACQUIRER,
  IHqAudioAcquirer,
} from 'src/application/ports/infrastructure/IHqAudioAcquirer';
import { ILogger, LOGGER } from 'src/application/ports/infrastructure/ILogger';
import { MusicTrackId } from 'src/kernel/ids';
import { IMusicTrackRepository } from '../../ports/repositories/IMusicTrackRepository';
import { isTrackAlreadyHq } from './hq-audio-status';

export class AcquireHqAudioUseCase {
  constructor(
    private readonly musicTrackRepository: IMusicTrackRepository,
    @Inject(HQ_AUDIO_ACQUIRER)
    private readonly hqAudioAcquirer: IHqAudioAcquirer,
    @Inject(LOGGER)
    private readonly logger: ILogger,
  ) {}

  async execute(trackId: MusicTrackId): Promise<void> {
    const track = await this.musicTrackRepository.getOneById(trackId);
    if (track.hqAudioPath) {
      return;
    }

    const filePath = track.fileInfo.filePath;
    if (isTrackAlreadyHq(track)) {
      await this.musicTrackRepository.updateOneById(trackId, {
        hqAudioPath: filePath,
        hqAudioSource: 'original',
      });
      return;
    }

    if (!track.artist || !track.title) {
      this.logger.warn('Skipping HQ acquisition: missing artist/title', {
        trackId,
        artist: track.artist,
        title: track.title,
      });
      return;
    }

    const result = await this.hqAudioAcquirer.acquire(
      track.artist,
      track.title,
      track.technicalInfo?.duration ?? 0,
      '',
    );

    if (!result) {
      this.logger.warn('No HQ audio source found', { trackId, artist: track.artist, title: track.title });
      return;
    }

    await this.musicTrackRepository.updateOneById(trackId, {
      hqAudioPath: result.filePath,
      hqAudioSource: result.source,
      hqAudioVerified: result.verified ?? false,
      hqAudioSpectralCutoffHz: result.spectralCutoffHz ?? undefined,
    });
  }
}
