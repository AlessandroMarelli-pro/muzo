import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ILogger } from 'src/application/ports/infrastructure/ILogger';
import { LOGGER_FACTORY } from 'src/application/ports/infrastructure/ILoggerFactory';
import { HqAudioConfig } from 'src/config/hq-audio.config';
import { StreamripAcquirer } from './streamrip.acquirer';

/**
 * Deezer via streamrip. Deezer serves 16-bit/44.1 kHz FLAC only (quality 2);
 * needs a personal `arl` cookie in the rip config file (DEEZER_RIP_CONFIG_PATH).
 */
@Injectable()
export class DeezerAcquirer extends StreamripAcquirer {
  protected readonly source = 'deezer' as const;

  constructor(
    configService: ConfigService,
    @Inject(LOGGER_FACTORY)
    loggerFactory: { createLogger: (name: string) => ILogger },
  ) {
    const hqAudio = configService.get<HqAudioConfig>('hqAudio')!;
    super(hqAudio.deezer, hqAudio.qualityTier, loggerFactory.createLogger('DeezerAcquirer'));
  }

  protected qualityFlag(): string {
    return '2';
  }
}
