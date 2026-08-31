import { MusicLibraryId, SessionId } from 'src/kernel/ids';
import { ILogger } from '../../ports/infrastructure/ILogger';
import { IMusicTrackRepository } from '../../ports/repositories/IMusicTrackRepository';
import { IScanSessionRepository } from '../../ports/repositories/IScanSessionRepository';
import { ScheduleBatchAudioScanUseCase } from './ScheduleBatchAudioScan';
import { trackToFileInfo } from './track-to-file-info';

/**
 * Re-runs analysis on every track in a library whose analysisStatus is not COMPLETED
 * (PENDING / PROCESSING / FAILED) -- i.e. the tracks that never got a full, successful
 * scan. Reuses the per-track batch pipeline, so no filesystem walk and COMPLETED tracks
 * are left untouched.
 */
export class ScheduleIncompleteTracksScanUseCase {
  constructor(
    private readonly musicTrackRepository: IMusicTrackRepository,
    private readonly scanSessionRepository: IScanSessionRepository,
    private readonly scheduleBatchAudioScanUseCase: ScheduleBatchAudioScanUseCase,
    loggerFactory: { createLogger: (name: string) => ILogger },
    private readonly logger: ILogger,
  ) {
    this.logger = loggerFactory.createLogger('ScheduleIncompleteTracksScanUseCase');
  }

  async execute(
    libraryId: MusicLibraryId,
  ): Promise<{ sessionId: SessionId; scheduledTrackCount: number; reused: boolean }> {
    const { session, created } =
      await this.scanSessionRepository.getActiveSessionOrCreate(libraryId);
    const sessionId = session.id;

    if (!created) {
      this.logger.info(
        `User already has an active session ${sessionId}; reusing it instead of starting an incomplete-tracks scan for library ${libraryId}`,
      );
      return { sessionId, scheduledTrackCount: 0, reused: true };
    }

    const tracks = await this.musicTrackRepository.getManyByLibraryIdNotCompleted(libraryId);

    if (tracks.length === 0) {
      this.logger.info(`No incomplete tracks in library ${libraryId}; nothing scheduled`);
      await this.scanSessionRepository.completeSession(sessionId, true);
      return { sessionId, scheduledTrackCount: 0, reused: false };
    }

    const fileInfos = tracks.map(trackToFileInfo);

    this.logger.info(
      `Scheduling incomplete-tracks scan for ${tracks.length} tracks in library ${libraryId}`,
      { sessionId },
    );

    await this.scheduleBatchAudioScanUseCase.execute(fileInfos, libraryId, sessionId, false, true);

    this.logger.info(
      `Scheduled incomplete-tracks scan for ${tracks.length} tracks in library ${libraryId}`,
      { sessionId },
    );

    return { sessionId, scheduledTrackCount: tracks.length, reused: false };
  }
}
