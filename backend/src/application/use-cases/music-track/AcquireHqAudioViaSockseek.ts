import { Inject } from '@nestjs/common';
import {
  HQ_AUDIO_ACQUIRER_SOCKSEEK_ONLY,
  IHqAudioAcquirer,
} from 'src/application/ports/infrastructure/IHqAudioAcquirer';
import { ILogger, LOGGER } from 'src/application/ports/infrastructure/ILogger';
import { MusicTrackId } from 'src/kernel/ids';
import { IMusicTrackRepository } from '../../ports/repositories/IMusicTrackRepository';

export type AcquireHqAudioViaSockseekOutcome =
  | 'succeeded'
  | 'skipped-already-hq'
  | 'skipped-missing-metadata'
  | 'not-found'
  | 'no-source-found';

export class AcquireHqAudioViaSockseekUseCase {
  constructor(
    private readonly musicTrackRepository: IMusicTrackRepository,
    @Inject(HQ_AUDIO_ACQUIRER_SOCKSEEK_ONLY)
    private readonly hqAudioAcquirer: IHqAudioAcquirer,
    @Inject(LOGGER)
    private readonly logger: ILogger,
  ) {}

  async execute(trackId: MusicTrackId): Promise<AcquireHqAudioViaSockseekOutcome> {
    const track = await this.musicTrackRepository.getOneById(trackId);
    if (!track) {
      return 'not-found';
    }
    if (track.hqAudioPath) {
      return 'skipped-already-hq';
    }

    const filePath = track.fileInfo.filePath;
    const ext = filePath.split('.').pop()?.toLowerCase();
    const isAlreadyHq =
      ext === 'flac' ||
      ext === 'wav' ||
      track.technicalInfo?.format?.toLowerCase() === 'flac' ||
      track.technicalInfo?.format?.toLowerCase() === 'wav';
    if (isAlreadyHq) {
      await this.musicTrackRepository.updateOneById(trackId, { hqAudioPath: filePath });
      return 'skipped-already-hq';
    }

    if (!track.artist || !track.title) {
      this.logger.warn('Skipping HQ acquisition: missing artist/title', {
        trackId,
        artist: track.artist,
        title: track.title,
      });
      return 'skipped-missing-metadata';
    }

    const result = await this.hqAudioAcquirer.acquire(
      track.artist,
      track.title,
      track.technicalInfo?.duration ?? 0,
      '',
    );

    if (!result) {
      this.logger.warn('No HQ audio source found via sockseek', {
        trackId,
        artist: track.artist,
        title: track.title,
      });
      return 'no-source-found';
    }

    await this.musicTrackRepository.updateOneById(trackId, {
      hqAudioPath: result.filePath,
    });
    return 'succeeded';
  }
}
