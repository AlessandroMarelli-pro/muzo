import { MusicLibraryId, SessionId } from 'src/kernel/ids';
import { AudioFileAnalysisStatusEnum, MusicTrack } from 'src/kernel/types';
import { AudioAnalysisResponse } from '../../ports/dtos/AudioAnalysis';
import {
  ScanErrorEvent,
  TrackCompleteEvent,
} from '../../ports/dtos/ScanProgress.types';
import { ILogger } from '../../ports/infrastructure/ILogger';
import { IScanProgressPublisher } from '../../ports/infrastructure/IScanProgressPublisher';
import { IAudioAnalysisRepository } from '../../ports/repositories/IAudioAnalysisRepository';
import { IMusicTrackRepository } from '../../ports/repositories/IMusicTrackRepository';

export class ProcessSingleTrackAnalysisUseCase {
  constructor(
    private readonly musicTrackRepository: IMusicTrackRepository,
    private readonly scanProgressPublisher: IScanProgressPublisher,
    private readonly audioAnalysisRepository: IAudioAnalysisRepository,
    loggerFactory: { createLogger: (name: string) => ILogger },
    private readonly logger: ILogger,
  ) {
    this.logger = loggerFactory.createLogger(
      'ProcessSingleTrackAnalysisUseCase',
    );
  }

  async execute(
    track: MusicTrack,
    analysisResult: AudioAnalysisResponse,
    batchInfo: {
      trackIndex: number;
      sessionId: SessionId;
      batchIndex: number;
      totalTracks: number;
      libraryId: MusicLibraryId;
    },
  ): Promise<{ isSuccess: boolean }> {
    const { trackIndex, sessionId, batchIndex, libraryId } = batchInfo;
    const analysisStatus = analysisResult.status;
    const fileName = track.fileInfo.fileName;
    try {
      // Check if analysis was successful
      if (!analysisStatus || analysisStatus === 'error') {
        this.logger.error(
          `Failed to analyze track ${fileName}: ${analysisStatus}`,
        );
        return { isSuccess: false };
      }

      // Validate required fields
      if (
        !analysisResult?.id3_tags?.artist &&
        !analysisResult?.id3_tags?.title &&
        !analysisResult?.ai_metadata?.artist &&
        !analysisResult?.ai_metadata?.title
      ) {
        this.logger.error(
          `Skipping audio scan for ${fileName} because it has no artist or title. Music track deleted.`,
          { analysisResult },
        );
        await this.musicTrackRepository.removeOneById(track.id);

        // Publish track failure event
        await this.sendTrackCompleteEvent(fileName, batchInfo);

        return { isSuccess: false };
      }

      this.logger.info(
        `Creating AudioFingerprint record for track ${fileName}`,
      );
      // Create AudioFingerprint record
      await this.audioAnalysisRepository.upsertAudioFingerprint(
        track.id,
        analysisResult,
      );

      this.logger.info(`Updating track ${fileName} with analysis results`);
      // Update track with AI metadata if available
      await this.musicTrackRepository.updateTrackWithAnalysis(
        track.id,
        analysisResult,
      );

      this.logger.info(`Successfully analyzed audio file: ${fileName}`);

      // Publish track complete event
      await this.sendTrackCompleteEvent(fileName, batchInfo);

      return { isSuccess: true };
    } catch (error) {
      this.logger.error(`Failed to process track ${fileName}:`, error.message);
      // Publish error event
      if (sessionId) {
        const errorEvent: ScanErrorEvent = {
          type: 'error',
          sessionId,
          timestamp: new Date().toISOString(),
          severity: 'error',
          source: 'backend',
          libraryId,
          batchIndex,
          trackIndex,
          error: {
            code: 'TRACK_PROCESSING_ERROR',
            message: error.message,
            details: { fileName },
          },
        };
        await this.scanProgressPublisher.publishError(sessionId, errorEvent);
      }

      this.logger.info(`Updating track ${fileName} with error status`);
      await this.musicTrackRepository.updateOneById(track.id, {
        analysisStatus: AudioFileAnalysisStatusEnum.FAILED,
        analysisError: error.message,
        analysisCompletedAt: new Date(),
      });
    }
    return { isSuccess: false };
  }

  private readonly sendTrackCompleteEvent = async (
    fileName: string,
    batchInfo: {
      trackIndex: number;
      sessionId: SessionId;
      batchIndex: number;
      totalTracks: number;
      libraryId: MusicLibraryId;
    },
  ) => {
    const { trackIndex, sessionId, batchIndex, totalTracks, libraryId } =
      batchInfo;
    if (!sessionId) {
      this.logger.warn(`No session ID found for track ${fileName}`);
      return;
    }
    this.logger.info(`Publishing track complete event for track ${fileName}`);
    const trackCompleteEvent: TrackCompleteEvent = {
      type: 'track.complete',
      sessionId,
      timestamp: new Date().toISOString(),
      libraryId,
      batchIndex,
      data: {
        totalTracks,
        trackIndex,
        fileName,
        success: false,
      },
    };
    await this.scanProgressPublisher.publishEvent(
      sessionId,
      trackCompleteEvent,
    );
  };
}
