import { FileInfo } from 'src/application/ports/dtos/FileInfo';
import { MusicTrackId, SessionId } from 'src/kernel/ids';
import { MusicTrack } from 'src/kernel/types';
import { ILogger } from '../../ports/infrastructure/ILogger';
import { IMusicTrackRepository } from '../../ports/repositories/IMusicTrackRepository';
import { IScanSessionRepository } from '../../ports/repositories/IScanSessionRepository';
import { ScheduleBatchAudioScanUseCase } from './ScheduleBatchAudioScan';

function trackToFileInfo(track: MusicTrack): FileInfo {
  const { filePath, fileName, fileSize, fileCreatedAt } = track.fileInfo;
  const lastDot = fileName.lastIndexOf('.');
  const extension = lastDot >= 0 ? fileName.slice(lastDot) : '';
  return {
    filePath,
    fileName,
    fileSize,
    extension: extension || '.mp3',
    lastModified: fileCreatedAt,
  };
}

export class ScheduleSingleTrackScanUseCase {
  constructor(
    private readonly musicTrackRepository: IMusicTrackRepository,
    private readonly scanSessionRepository: IScanSessionRepository,
    private readonly scheduleBatchAudioScanUseCase: ScheduleBatchAudioScanUseCase,
    loggerFactory: { createLogger: (name: string) => ILogger },
    private readonly logger: ILogger,
  ) {
    this.logger = loggerFactory.createLogger('ScheduleSingleTrackScanUseCase');
  }

  async execute(
    trackId: MusicTrackId,
    force: boolean,
  ): Promise<{ sessionId: SessionId }> {
    const track = await this.musicTrackRepository.getOneById(trackId);
    const fileInfo = trackToFileInfo(track);
    const session = await this.scanSessionRepository.createSession(null);
    const sessionId = session.id;

    this.logger.info(`Scheduling single track scan for track ${trackId}`, {
      trackId,
      sessionId,
      force,
    });

    await this.scheduleBatchAudioScanUseCase.execute(
      [fileInfo],
      track.libraryId,
      sessionId,
      false,
      force,
    );

    this.logger.info(`Scheduled single track scan for track ${trackId}`, {
      trackId,
      sessionId,
    });

    return { sessionId };
  }
}
