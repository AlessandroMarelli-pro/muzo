import { MusicLibraryId, SessionId } from 'src/kernel/ids';
import { FilterCriteria, MusicTrack } from 'src/kernel/types/model-types';
import { ILogger } from '../../ports/infrastructure/ILogger';
import { IMusicTrackRepository } from '../../ports/repositories/IMusicTrackRepository';
import { IScanSessionRepository } from '../../ports/repositories/IScanSessionRepository';
import { ScheduleBatchAudioScanUseCase } from './ScheduleBatchAudioScan';
import { trackToFileInfo } from './track-to-file-info';

export interface ScheduleTracksByCriteriaScanOptions {
  subgenreSelectionMode?: 'exact' | 'contain';
  force?: boolean;
  /** Undefined means no cap: schedule every track matching the criteria. */
  limit?: number;
}

export class ScheduleTracksByCriteriaScanUseCase {
  constructor(
    private readonly musicTrackRepository: IMusicTrackRepository,
    private readonly scanSessionRepository: IScanSessionRepository,
    private readonly scheduleBatchAudioScanUseCase: ScheduleBatchAudioScanUseCase,
    loggerFactory: { createLogger: (name: string) => ILogger },
    private readonly logger: ILogger,
  ) {
    this.logger = loggerFactory.createLogger('ScheduleTracksByCriteriaScanUseCase');
  }

  async execute(
    criteria: FilterCriteria,
    options: ScheduleTracksByCriteriaScanOptions = {},
  ): Promise<{ sessionId: SessionId; matchedTrackCount: number; reused: boolean }> {
    const { subgenreSelectionMode = 'exact', force, limit } = options;
    console.log('ScheduleTracksByCriteriaScanUseCase', criteria, options);

    const { session: activeOrNewSession, created } =
      await this.scanSessionRepository.getActiveSessionOrCreate(null);
    if (!created) {
      this.logger.info(
        `User already has an active session ${activeOrNewSession.id}; reusing it instead of starting a new criteria scan`,
      );
      return { sessionId: activeOrNewSession.id, matchedTrackCount: 0, reused: true };
    }

    const tracks = await this.musicTrackRepository.getManyByCriteria(
      criteria,
      subgenreSelectionMode,
      { limit, offset: 0, orderBy: 'fileCreatedAt', orderDirection: 'desc' },
      false, // withIncludes: only fileInfo/libraryId are needed here
    );

    const sessionId = activeOrNewSession.id;

    if (tracks.length === 0) {
      this.logger.info('No tracks matched criteria; nothing scheduled', { criteria });
      await this.scanSessionRepository.completeSession(sessionId, true);
      return { sessionId, matchedTrackCount: 0, reused: false };
    }

    // scheduleBatchAudioScan is scoped to a single library per call (the library id is
    // stamped onto every upserted MusicTrack row downstream), so a criteria match spanning
    // multiple libraries must be grouped and scheduled per library.
    const tracksByLibrary = new Map<MusicLibraryId, MusicTrack[]>();
    for (const track of tracks) {
      const bucket = tracksByLibrary.get(track.libraryId) ?? [];
      bucket.push(track);
      tracksByLibrary.set(track.libraryId, bucket);
    }

    this.logger.info(
      `Scheduling criteria-based scan for ${tracks.length} tracks across ${tracksByLibrary.size} libraries`,
      { sessionId, force },
    );

    for (const [libraryId, libraryTracks] of tracksByLibrary) {
      const fileInfos = libraryTracks.map(trackToFileInfo);
      await this.scheduleBatchAudioScanUseCase.execute(
        fileInfos,
        libraryId,
        sessionId,
        false,
        force,
      );
    }

    this.logger.info(
      `Scheduled criteria-based scan for ${tracks.length} tracks across ${tracksByLibrary.size} libraries`,
      { sessionId },
    );

    return { sessionId, matchedTrackCount: tracks.length, reused: false };
  }
}
