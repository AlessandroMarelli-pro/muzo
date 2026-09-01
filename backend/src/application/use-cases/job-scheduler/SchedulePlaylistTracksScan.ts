import { MusicLibraryId, PlaylistId, SessionId } from 'src/kernel/ids';
import { MusicTrack } from 'src/kernel/types/model-types';
import { ILogger } from '../../ports/infrastructure/ILogger';
import { IPlaylistRepository } from '../../ports/repositories/IPlaylistRepository';
import { IScanSessionRepository } from '../../ports/repositories/IScanSessionRepository';
import { ScheduleBatchAudioScanUseCase } from './ScheduleBatchAudioScan';
import { trackToFileInfo } from './track-to-file-info';

export class SchedulePlaylistTracksScanUseCase {
  constructor(
    private readonly playlistRepository: IPlaylistRepository,
    private readonly scanSessionRepository: IScanSessionRepository,
    private readonly scheduleBatchAudioScanUseCase: ScheduleBatchAudioScanUseCase,
    loggerFactory: { createLogger: (name: string) => ILogger },
    private readonly logger: ILogger,
  ) {
    this.logger = loggerFactory.createLogger('SchedulePlaylistTracksScanUseCase');
  }

  async execute(
    playlistId: PlaylistId,
    force: boolean,
  ): Promise<{ sessionId: SessionId; matchedTrackCount: number; reused: boolean }> {
    const { session, created } = await this.scanSessionRepository.getActiveSessionOrCreate(null);
    const sessionId = session.id;

    if (!created) {
      this.logger.info(
        `User already has an active session ${sessionId}; reusing it instead of starting a new playlist scan for ${playlistId}`,
      );
      return { sessionId, matchedTrackCount: 0, reused: true };
    }

    const playlist = await this.playlistRepository.getOneByIdWithTracks(playlistId, null);
    const tracks: MusicTrack[] = playlist.tracks.map((playlistTrack) => playlistTrack.track);

    if (tracks.length === 0) {
      this.logger.info('Playlist has no tracks; nothing scheduled', { playlistId });
      await this.scanSessionRepository.completeSession(sessionId, true);
      return { sessionId, matchedTrackCount: 0, reused: false };
    }

    // scheduleBatchAudioScan is scoped to a single library per call, so group the
    // playlist's tracks by library and schedule one batch per library.
    const tracksByLibrary = new Map<MusicLibraryId, MusicTrack[]>();
    for (const track of tracks) {
      const bucket = tracksByLibrary.get(track.libraryId) ?? [];
      bucket.push(track);
      tracksByLibrary.set(track.libraryId, bucket);
    }

    this.logger.info(
      `Scheduling playlist scan for ${tracks.length} tracks across ${tracksByLibrary.size} libraries`,
      { sessionId, playlistId, force },
    );

    for (const [libraryId, libraryTracks] of tracksByLibrary) {
      const fileInfos = libraryTracks.map(trackToFileInfo);
      await this.scheduleBatchAudioScanUseCase.execute(fileInfos, libraryId, sessionId, false, force);
    }

    this.logger.info(`Scheduled playlist scan for ${tracks.length} tracks`, {
      sessionId,
      playlistId,
    });

    return { sessionId, matchedTrackCount: tracks.length, reused: false };
  }
}
