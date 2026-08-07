import { randomUUID } from 'crypto';
import { HqAudioBatchState, HqAudioBatchTrackState } from 'src/application/ports/dtos/HqAudioBatchProgress.types';
import { ILogger } from 'src/application/ports/infrastructure/ILogger';
import { IHqAudioBatchAcquireProducer } from 'src/application/ports/infrastructure/IHqAudioBatchAcquireProducer';
import { IHqAudioBatchProgressPublisher } from 'src/application/ports/infrastructure/IHqAudioBatchProgressPublisher';
import { IPlaylistRepository } from 'src/application/ports/repositories/IPlaylistRepository';
import { IPlaylistSortingRepository } from 'src/application/ports/repositories/IPlaylistSortingRepository';
import { HqAudioBatchId, MusicTrackId, PlaylistId } from 'src/kernel/ids';
import { getCurrentUser } from 'src/kernel/types/context';

function isTrackAlreadyHq(track: { hqAudioPath?: string | null; fileInfo: { filePath: string }; technicalInfo?: { format?: string | null } | null }): boolean {
  if (track.hqAudioPath) {
    return true;
  }
  const ext = track.fileInfo.filePath.split('.').pop()?.toLowerCase();
  return (
    ext === 'flac' ||
    ext === 'wav' ||
    track.technicalInfo?.format?.toLowerCase() === 'flac' ||
    track.technicalInfo?.format?.toLowerCase() === 'wav'
  );
}

export class StartHqAudioBatchDownloadUseCase {
  constructor(
    private readonly playlistRepository: IPlaylistRepository,
    private readonly playlistSortingRepository: IPlaylistSortingRepository,
    private readonly hqAudioBatchProgressPublisher: IHqAudioBatchProgressPublisher,
    private readonly hqAudioBatchAcquireProducer: IHqAudioBatchAcquireProducer,
    loggerFactory: { createLogger: (name: string) => ILogger },
    private readonly logger: ILogger,
  ) {
    this.logger = loggerFactory.createLogger('StartHqAudioBatchDownloadUseCase');
  }

  async execute(playlistId: PlaylistId): Promise<{ batchId: HqAudioBatchId; totalToDownload: number }> {
    const sorting = await this.playlistSortingRepository.getByPlaylistId(playlistId);
    const playlist = await this.playlistRepository.getOneByIdWithTracks(playlistId, sorting);

    const batchId = randomUUID() as HqAudioBatchId;
    const now = new Date().toISOString();

    const trackStates: HqAudioBatchTrackState[] = [];
    const trackIdsToDownload: MusicTrackId[] = [];

    playlist.tracks.forEach((playlistTrack, position) => {
      const track = playlistTrack.track;
      const trackState: HqAudioBatchTrackState = {
        trackId: track.id,
        position,
        artist: track.artist ?? '',
        title: track.title ?? '',
        status: isTrackAlreadyHq(track) ? 'skipped' : 'queued',
      };
      trackStates.push(trackState);
      if (trackState.status === 'queued') {
        trackIdsToDownload.push(track.id);
      }
    });

    const state: HqAudioBatchState = {
      batchId,
      playlistId,
      total: trackStates.length,
      queued: trackIdsToDownload.length,
      downloading: 0,
      succeeded: 0,
      failed: 0,
      skipped: trackStates.length - trackIdsToDownload.length,
      cancelled: 0,
      status: trackIdsToDownload.length > 0 ? 'running' : 'completed',
      startedAt: now,
      updatedAt: now,
      tracks: trackStates,
    };

    await this.hqAudioBatchProgressPublisher.setState(batchId, state);

    this.logger.info('Starting HQ audio batch download', {
      batchId,
      playlistId,
      total: state.total,
      toDownload: trackIdsToDownload.length,
    });

    if (trackIdsToDownload.length > 0) {
      await this.hqAudioBatchAcquireProducer.scheduleBatch(batchId, trackIdsToDownload, getCurrentUser());
    }

    return { batchId, totalToDownload: trackIdsToDownload.length };
  }
}
