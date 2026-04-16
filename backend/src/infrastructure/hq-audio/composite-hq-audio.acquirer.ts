import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  HqAudioAcquireResult,
  IHqAudioAcquirer,
} from 'src/application/ports/infrastructure/IHqAudioAcquirer';
import { ILogger, LOGGER } from 'src/application/ports/infrastructure/ILogger';
import { LOGGER_FACTORY } from 'src/application/ports/infrastructure/ILoggerFactory';
import { SlskdAcquirer } from './slskd.acquirer';
import { TidalDlAcquirer } from './tidal-dl.acquirer';

@Injectable()
export class CompositeHqAudioAcquirer implements IHqAudioAcquirer {
  private readonly outputDir: string;

  constructor(
    private readonly tidalDlAcquirer: TidalDlAcquirer,
    private readonly slskdAcquirer: SlskdAcquirer,
    private readonly configService: ConfigService,
    @Inject(LOGGER_FACTORY)
    loggerFactory: { createLogger: (name: string) => ILogger },
    @Inject(LOGGER)
    private readonly logger: ILogger,
  ) {
    this.logger = loggerFactory.createLogger('CompositeHqAudioAcquirer');
    this.outputDir = this.configService.get<string>('hqAudio.outputDir') ?? '/tmp/muzo-hq-audio';
  }

  async acquire(
    artist: string,
    title: string,
    durationSeconds: number,
    outputDir: string,
  ): Promise<HqAudioAcquireResult | null> {
    try {
      const tidal = await this.tidalDlAcquirer.acquire(
        artist,
        title,
        durationSeconds,
        outputDir || this.outputDir,
      );
      if (tidal) {
        this.logger.info('HQ acquisition succeeded via Tidal', {
          artist,
          title,
          filePath: tidal.filePath,
        });
        return tidal;
      }
    } catch (error) {
      this.logger.warn('HQ acquisition via Tidal failed, trying slskd', {
        artist,
        title,
        error: String(error),
      });
    }

    const soulseek = await this.slskdAcquirer.acquire(
      artist,
      title,
      durationSeconds,
      outputDir || this.outputDir,
    );
    if (soulseek) {
      this.logger.info('HQ acquisition succeeded via slskd', {
        artist,
        title,
        filePath: soulseek.filePath,
      });
    }
    return soulseek;
  }
}
