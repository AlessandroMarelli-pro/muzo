import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  HqAudioAcquireResult,
  IHqAudioAcquirer,
} from 'src/application/ports/infrastructure/IHqAudioAcquirer';
import { ILogger, LOGGER } from 'src/application/ports/infrastructure/ILogger';
import { LOGGER_FACTORY } from 'src/application/ports/infrastructure/ILoggerFactory';
import { HqAudioSource } from 'src/kernel/types/model-types';
import { SockseekAcquirer } from './sockseek.acquirer';
import { TidalDlAcquirer } from './tidal-dl.acquirer';

/**
 * Tries each configured source in `hqAudio.sourceOrder` until one returns a
 * file. A source named in the order but not registered (e.g. Qobuz before its
 * acquirer is wired) is skipped with a warning; a source that throws is logged
 * and the cascade continues.
 */
@Injectable()
export class CompositeHqAudioAcquirer implements IHqAudioAcquirer {
  private readonly registry: Partial<Record<HqAudioSource, IHqAudioAcquirer>>;

  constructor(
    private readonly tidalDlAcquirer: TidalDlAcquirer,
    private readonly sockseekAcquirer: SockseekAcquirer,
    private readonly configService: ConfigService,
    @Inject(LOGGER_FACTORY)
    loggerFactory: { createLogger: (name: string) => ILogger },
    @Inject(LOGGER)
    private readonly logger: ILogger,
  ) {
    this.logger = loggerFactory.createLogger('CompositeHqAudioAcquirer');
    // New sources (qobuz, deezer, ...) register here as their acquirers land.
    this.registry = {
      tidal: this.tidalDlAcquirer,
      soulseek: this.sockseekAcquirer,
    };
  }

  private resolveOrder(): HqAudioSource[] {
    const configured =
      this.configService.get<string[]>('hqAudio.sourceOrder') ?? ['tidal', 'soulseek'];
    return configured.filter(
      (name): name is HqAudioSource => name in this.registry,
    );
  }

  async acquire(
    artist: string,
    title: string,
    durationSeconds: number,
    outputDir: string,
  ): Promise<HqAudioAcquireResult | null> {
    const order = this.resolveOrder();
    if (order.length === 0) {
      this.logger.warn('No HQ audio sources are enabled', { artist, title });
      return null;
    }

    for (const source of order) {
      const acquirer = this.registry[source];
      if (!acquirer) {
        continue;
      }
      try {
        const result = await acquirer.acquire(artist, title, durationSeconds, outputDir);
        if (result) {
          this.logger.info('HQ acquisition succeeded', {
            artist,
            title,
            source,
            filePath: result.filePath,
          });
          return { ...result, source: result.source ?? source };
        }
        this.logger.info('HQ source found no match, trying next', { artist, title, source });
      } catch (error) {
        this.logger.warn('HQ source failed, trying next', {
          artist,
          title,
          source,
          error: String(error),
        });
      }
    }

    this.logger.warn('No HQ audio source produced a file', { artist, title });
    return null;
  }
}
