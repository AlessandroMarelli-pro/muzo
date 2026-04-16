import { Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  HQ_AUDIO_ACQUIRER,
  IHqAudioAcquirer,
} from 'src/application/ports/infrastructure/IHqAudioAcquirer';
import { ILogger, LOGGER } from 'src/application/ports/infrastructure/ILogger';
import { MusicTrackId } from 'src/kernel/ids';
import { IMusicTrackRepository } from '../../ports/repositories/IMusicTrackRepository';

export class AcquireHqAudioUseCase {
  private readonly outputDir: string;

  constructor(
    private readonly musicTrackRepository: IMusicTrackRepository,
    @Inject(HQ_AUDIO_ACQUIRER)
    private readonly hqAudioAcquirer: IHqAudioAcquirer,
    private readonly configService: ConfigService,
    @Inject(LOGGER)
    private readonly logger: ILogger,
  ) {
    this.outputDir =
      this.configService.get<string>('hqAudio.outputDir') ??
      this.configService.get<string>('HQ_AUDIO_OUTPUT_DIR') ??
      '/tmp/muzo-hq-audio';
  }

  async execute(trackId: MusicTrackId): Promise<void> {
    const track = await this.musicTrackRepository.getOneById(trackId);
    if (track.hqAudioPath) {
      return;
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
      this.outputDir,
    );

    if (!result) {
      this.logger.warn('No HQ audio source found', { trackId, artist: track.artist, title: track.title });
      return;
    }

    await this.musicTrackRepository.updateOneById(trackId, {
      hqAudioPath: result.filePath,
    });
  }
}
