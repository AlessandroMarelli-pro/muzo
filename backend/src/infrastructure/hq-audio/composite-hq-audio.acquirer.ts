import { Inject, Injectable } from '@nestjs/common';
import {
  HqAudioAcquireResult,
  IHqAudioAcquirer,
} from 'src/application/ports/infrastructure/IHqAudioAcquirer';
import { ILogger, LOGGER } from 'src/application/ports/infrastructure/ILogger';
import { LOGGER_FACTORY } from 'src/application/ports/infrastructure/ILoggerFactory';
import { SockseekAcquirer } from './sockseek.acquirer';
import { TidalDlAcquirer } from './tidal-dl.acquirer';

@Injectable()
export class CompositeHqAudioAcquirer implements IHqAudioAcquirer {
  constructor(
    private readonly tidalDlAcquirer: TidalDlAcquirer,
    private readonly sockseekAcquirer: SockseekAcquirer,
    @Inject(LOGGER_FACTORY)
    loggerFactory: { createLogger: (name: string) => ILogger },
    @Inject(LOGGER)
    private readonly logger: ILogger,
  ) {
    this.logger = loggerFactory.createLogger('CompositeHqAudioAcquirer');
  }

  async acquire(
    artist: string,
    title: string,
    durationSeconds: number,
    outputDir: string,
  ): Promise<HqAudioAcquireResult | null> {
    try {
      const tidal = await this.tidalDlAcquirer.acquire(artist, title, durationSeconds, outputDir);
      if (tidal) {
        this.logger.info('HQ acquisition succeeded via Tidal', {
          artist,
          title,
          filePath: tidal.filePath,
        });
        return tidal;
      }
    } catch (error) {
      this.logger.warn('HQ acquisition via Tidal failed, trying sockseek', {
        artist,
        title,
        error: String(error),
      });
    }

    const soulseek = await this.sockseekAcquirer.acquire(artist, title, durationSeconds, outputDir);
    if (soulseek) {
      this.logger.info('HQ acquisition succeeded via sockseek', {
        artist,
        title,
        filePath: soulseek.filePath,
      });
    }
    return soulseek;
  }
}
