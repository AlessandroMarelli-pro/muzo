import { Inject } from '@nestjs/common';
import { ILogger, LOGGER } from 'src/application/ports/infrastructure/ILogger';
import { LOGGER_FACTORY } from 'src/application/ports/infrastructure/ILoggerFactory';
import { MusicTrackId } from 'src/kernel/ids';
import { models } from 'src/kernel/types/models';
import { IHiddenMusicTrackRepository } from '../../ports/repositories/IHiddenMusicTrackRepository';
import { IMusicTrackRepository } from '../../ports/repositories/IMusicTrackRepository';

export class ToggleDislikeUseCase {
  constructor(
    private readonly musicTrackRepository: IMusicTrackRepository,
    private readonly hiddenMusicTrackRepository: IHiddenMusicTrackRepository,
    @Inject(LOGGER_FACTORY)
    loggerFactory: { createLogger: (name: string) => ILogger },
    @Inject(LOGGER)
    private readonly logger: ILogger,
  ) {
    this.logger = loggerFactory.createLogger('ToggleDislikeUseCase');
  }

  async execute(id: MusicTrackId): Promise<boolean> {
    const track = await this.musicTrackRepository.getOneById(id);
    this.logger.info('Toggling dislike for track', {
      trackId: id,
      track,
    });
    await this.hiddenMusicTrackRepository.save(
      models.hiddenMusicTrack.instantiateNew({
        ...track,
        artist: track.artist ?? '',
        title: track.title ?? '',
        imagePath: track.imagePath ?? '',
        libraryId: track.libraryId,
        fileInfo: track.fileInfo,
        technicalInfo: track.technicalInfo ?? undefined,
      }),
    );
    this.logger.info('Track disliked', {
      trackId: id,
      track,
    });
    try {
      return this.musicTrackRepository.removeOneById(id);
    } catch (error) {
      this.logger.error('Error removing track', {
        trackId: id,
        error,
      });
      throw error;
    }
  }
}
