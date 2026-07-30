import { MusicLibraryId, SessionId } from 'src/kernel/ids';
import { FilterCriteria, MusicTrack } from 'src/kernel/types/model-types';
import { ILogger } from '../../ports/infrastructure/ILogger';
import { IMusicTrackRepository } from '../../ports/repositories/IMusicTrackRepository';
import { IScanSessionRepository } from '../../ports/repositories/IScanSessionRepository';
import { ScheduleBatchAudioScanUseCase } from './ScheduleBatchAudioScan';
import { trackToFileInfo } from './track-to-file-info';

const AUDIO_SCAN_BATCH_SIZE = 10;

export interface ScheduleTracksByCriteriaScanOptions {
  subgenreSelectionMode?: 'exact' | 'contain';
  skipAiMetadata?: boolean;
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
  ): Promise<{ sessionId: SessionId; matchedTrackCount: number }> {
    const { subgenreSelectionMode = 'exact', skipAiMetadata, force, limit } = options;

    const tracks = await this.musicTrackRepository.getManyByCriteria(
      criteria,
      subgenreSelectionMode,
      { limit, offset: 0, orderBy: 'fileCreatedAt', orderDirection: 'desc' },
      false, // withIncludes: only fileInfo/libraryId are needed here
    );

    if (tracks.length === 0) {
      this.logger.info('No tracks matched criteria; nothing scheduled', { criteria });
      const session = await this.scanSessionRepository.createSession(null);
      return { sessionId: session.id, matchedTrackCount: 0 };
    }

    const session = await this.scanSessionRepository.createSession(null);
    const sessionId = session.id;

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
      { sessionId, skipAiMetadata, force },
    );

    let totalBatches = 0;
    for (const [libraryId, libraryTracks] of tracksByLibrary) {
      const fileInfos = libraryTracks.map(trackToFileInfo);
      totalBatches += Math.ceil(fileInfos.length / AUDIO_SCAN_BATCH_SIZE);
      await this.scheduleBatchAudioScanUseCase.execute(
        fileInfos,
        libraryId,
        sessionId,
        false,
        force,
        skipAiMetadata,
      );
    }

    // scheduleBatchAudioScan's producer overwrites the session's totalTracks/totalBatches on
    // every call (no increment path exists), so with multiple libraries the last call would
    // otherwise leave the session reflecting only its own library's totals. This final update
    // wins as the last write and reflects the true cross-library grand total.
    await this.scanSessionRepository.updateSession(sessionId, {
      totalTracks: tracks.length,
      totalBatches,
    });

    this.logger.info(
      `Scheduled criteria-based scan for ${tracks.length} tracks across ${tracksByLibrary.size} libraries`,
      { sessionId },
    );

    return { sessionId, matchedTrackCount: tracks.length };
  }
}
