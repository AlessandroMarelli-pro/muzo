import { Inject, Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  AudioArtwork,
  COPY_AUDIO_WITH_METADATA,
  ICopyAudioWithMetadata,
} from 'src/application/ports/infrastructure/ICopyAudioWithMetadata';
import { IHqAudioTagger } from 'src/application/ports/infrastructure/IHqAudioTagger';
import { ILogger, LOGGER } from 'src/application/ports/infrastructure/ILogger';
import { LOGGER_FACTORY } from 'src/application/ports/infrastructure/ILoggerFactory';
import {
  IImageSearchRepository,
  IMAGE_SEARCH_REPOSITORY,
} from 'src/application/ports/repositories/IImageSearchRepository';
import { buildAudioTagMetadata } from 'src/application/use-cases/music-track/audio-tag-metadata';
import { MusicTrack } from 'src/kernel/types/model-types';

/**
 * Tags an acquired HQ file in place so it is self-describing before any
 * playlist export. Writes to a sibling temp file then renames over the
 * original — `copyAudioWithMetadata` does `-c:a copy`, so there is no quality
 * loss. Never throws: acquisition succeeding must not depend on tagging.
 */
@Injectable()
export class HqAudioTaggerAdapter implements IHqAudioTagger {
  constructor(
    @Inject(COPY_AUDIO_WITH_METADATA)
    private readonly copyAudioWithMetadata: ICopyAudioWithMetadata,
    @Inject(IMAGE_SEARCH_REPOSITORY)
    private readonly imageSearchRepository: IImageSearchRepository,
    @Inject(LOGGER_FACTORY)
    loggerFactory: { createLogger: (name: string) => ILogger },
    @Inject(LOGGER)
    private readonly logger: ILogger,
  ) {
    this.logger = loggerFactory.createLogger('HqAudioTaggerAdapter');
  }

  async tagInPlace(filePath: string, track: MusicTrack): Promise<void> {
    const metadata = buildAudioTagMetadata(track);
    const ext = path.extname(filePath) || '.flac';
    const tempPath = path.join(
      path.dirname(filePath),
      `.muzo-tag-${crypto.randomUUID()}${ext}`,
    );

    let artwork: AudioArtwork | undefined;
    try {
      const stored = await this.imageSearchRepository.findLatestImageForTrack(track.id);
      artwork = stored ?? undefined;
    } catch (error) {
      this.logger.warn('Failed to load cover art for acquisition tagging', {
        trackId: track.id,
        error: String(error),
      });
    }

    try {
      try {
        await this.copyAudioWithMetadata.copyAudioWithMetadata(
          filePath,
          tempPath,
          metadata,
          artwork,
        );
      } catch (error) {
        if (!artwork) {
          throw error;
        }
        this.logger.warn('Tagging with artwork failed, retrying without it', {
          filePath,
          error: String(error),
        });
        await this.copyAudioWithMetadata.copyAudioWithMetadata(
          filePath,
          tempPath,
          metadata,
          undefined,
        );
      }
      await fs.rename(tempPath, filePath);
      this.logger.info('Tagged acquired HQ file in place', {
        filePath,
        trackId: track.id,
        hasArtwork: !!artwork,
      });
    } catch (error) {
      this.logger.warn('Failed to tag acquired HQ file, leaving it untagged', {
        filePath,
        trackId: track.id,
        error: String(error),
      });
      await fs.unlink(tempPath).catch(() => undefined);
    }
  }
}
