import { MusicLibraryId, SessionId } from 'src/clean-arch/kernel/ids';
import {
  AudioFileAnalysisStatusEnum,
  MusicTrack,
} from 'src/clean-arch/kernel/types';
import { AudioAnalysisResponse } from '../../ports/dtos/AudioAnalysis';
import {
  ScanErrorEvent,
  TrackCompleteEvent,
} from '../../ports/dtos/ScanProgress.types';
import { IScanProgressPublisher } from '../../ports/infrastructure/IScanProgressPublisher';
import { IAudioAnalysisRepository } from '../../ports/repositories/IAudioAnalysisRepository';
import { IMusicTrackRepository } from '../../ports/repositories/IMusicTrackRepository';

export class ProcessSingleTrackAnalysisUseCase {
  constructor(
    private readonly musicTrackRepository: IMusicTrackRepository,
    private readonly scanProgressPublisher: IScanProgressPublisher,
    private readonly audioAnalysisRepository: IAudioAnalysisRepository,
  ) {}

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
        return { isSuccess: false };
      }

      // Validate required fields
      if (
        !analysisResult?.id3_tags?.artist &&
        !analysisResult?.id3_tags?.title &&
        !analysisResult?.ai_metadata?.artist &&
        !analysisResult?.ai_metadata?.title
      ) {
        console.log(
          `Skipping audio scan for ${fileName} because it has no artist or title. Music track deleted.`,
        );
        await this.musicTrackRepository.removeOneById(track.id);

        // Publish track failure event
        await this.sendTrackCompleteEvent(fileName, batchInfo);

        return { isSuccess: false };
      }

      // Create AudioFingerprint record
      await this.audioAnalysisRepository.upsertAudioFingerprint(
        track.id,
        analysisResult,
      );

      // Update track with AI metadata if available
      await this.musicTrackRepository.updateTrackWithAnalysis(
        track.id,
        analysisResult,
      );

      console.log(`Successfully analyzed audio file: ${fileName}`);

      // Publish track complete event
      await this.sendTrackCompleteEvent(fileName, batchInfo);

      return { isSuccess: true };
    } catch (error) {
      console.error(`Failed to process track ${fileName}:`, error.message);
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

      await this.musicTrackRepository.updateOneById(track.id, {
        analysisStatus: AudioFileAnalysisStatusEnum.FAILED,
        analysisError: error.message,
        analysisCompletedAt: new Date(),
      });
    }
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
    if (!sessionId) return;
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
