import { Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  HQ_AUDIO_ENHANCER,
  IHqAudioEnhancer,
} from 'src/application/ports/infrastructure/IHqAudioEnhancer';
import { ILogger, LOGGER } from 'src/application/ports/infrastructure/ILogger';
import { HqAudioConfig } from 'src/config/hq-audio.config';
import { MusicTrackId } from 'src/kernel/ids';
import { IMusicTrackRepository } from '../../ports/repositories/IMusicTrackRepository';
import { isTrackAlreadyHq } from './hq-audio-status';

export class EnhanceHqAudioUseCase {
  constructor(
    private readonly musicTrackRepository: IMusicTrackRepository,
    @Inject(HQ_AUDIO_ENHANCER)
    private readonly hqAudioEnhancer: IHqAudioEnhancer,
    @Inject(LOGGER)
    private readonly logger: ILogger,
    private readonly configService: ConfigService,
  ) {}

  async execute(trackId: MusicTrackId): Promise<void> {
    const track = await this.musicTrackRepository.getOneById(trackId);

    // Defensive re-check: this runs async via a BullMQ job, so the track's
    // HQ status may have changed between menu render and job execution.
    if (isTrackAlreadyHq(track)) {
      this.logger.info('Skipping enhance: track already HQ', { trackId });
      return;
    }

    const inputFilePath = track.hqAudioPath ?? track.fileInfo.filePath;
    const hqAudioConfig = this.configService.get<HqAudioConfig>('hqAudio')!;
    const outputDir = hqAudioConfig.universr.outputDir;

    const result = await this.hqAudioEnhancer.enhance(inputFilePath, outputDir);

    await this.musicTrackRepository.updateOneById(trackId, {
      hqAudioPath: result.filePath,
    });
  }
}
