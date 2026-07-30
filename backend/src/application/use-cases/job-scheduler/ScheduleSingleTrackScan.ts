import { MusicTrackId, SessionId } from 'src/kernel/ids';
import { ILogger } from '../../ports/infrastructure/ILogger';
import { IMusicTrackRepository } from '../../ports/repositories/IMusicTrackRepository';
import { IScanSessionRepository } from '../../ports/repositories/IScanSessionRepository';
import { ScheduleBatchAudioScanUseCase } from './ScheduleBatchAudioScan';
import { trackToFileInfo } from './track-to-file-info';

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
