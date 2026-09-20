import { Inject } from '@nestjs/common';
import { ILogger, LOGGER } from 'src/application/ports/infrastructure/ILogger';
import { LOGGER_FACTORY } from 'src/application/ports/infrastructure/ILoggerFactory';
import { HiddenMusicTrackId } from 'src/kernel/ids';
import { AudioFileAnalysisStatusEnum, MusicTrack } from 'src/kernel/types';
import { IHiddenMusicTrackRepository } from '../../ports/repositories/IHiddenMusicTrackRepository';
import { IMusicTrackRepository } from '../../ports/repositories/IMusicTrackRepository';

export class RestoreHiddenTrackUseCase {
  constructor(
    private readonly hiddenMusicTrackRepository: IHiddenMusicTrackRepository,
    private readonly musicTrackRepository: IMusicTrackRepository,
    @Inject(LOGGER_FACTORY)
    loggerFactory: { createLogger: (name: string) => ILogger },
    @Inject(LOGGER)
    private readonly logger: ILogger,
  ) {
    this.logger = loggerFactory.createLogger('RestoreHiddenTrackUseCase');
  }

  async execute(id: HiddenMusicTrackId): Promise<MusicTrack> {
    const hidden = await this.hiddenMusicTrackRepository.getOneById(id);

    const track = await this.musicTrackRepository.upsertOne({
      filePath: hidden.fileInfo.filePath,
      libraryId: hidden.libraryId,
      fileName: hidden.fileInfo.fileName,
      fileSize: hidden.fileInfo.fileSize,
      fileCreatedAt: hidden.fileInfo.fileCreatedAt,
      duration: hidden.technicalInfo?.duration ?? 0,
      format: hidden.technicalInfo?.format ?? '',
      analysisStatus: AudioFileAnalysisStatusEnum.PENDING,
      analysisStartedAt: new Date(),
    });

    await this.hiddenMusicTrackRepository.removeOneById(id);

    this.logger.info('Restored hidden track', { hiddenTrackId: id, trackId: track.id });

    return track;
  }
}
