import fs from 'fs';
import { ILogger } from 'src/application/ports/infrastructure/ILogger';
import { IMusicTrackRepository } from 'src/application/ports/repositories/IMusicTrackRepository';
import {
  AudioFileAnalysisStatusEnum,
  MusicTrack,
  ScanStatusEnum,
} from 'src/kernel/types';
import { AudioAnalysisResponse } from '../../ports/dtos/AudioAnalysis';
import {
  AudioFile,
  AudioScanBatchJobData,
} from '../../ports/dtos/JobSchedulersData';
import { TrackCompleteEvent } from '../../ports/dtos/ScanProgress.types';
import { IAudioAnalysisStructure } from '../../ports/infrastructure/IAudioAnalysisStructure';
import { IScanProgressPublisher } from '../../ports/infrastructure/IScanProgressPublisher';
import { IMusicLibraryRepository } from '../../ports/repositories/IMusicLibraryRepository';
import { IScanSessionRepository } from '../../ports/repositories/IScanSessionRepository';

export class ProcessBatchAudioScanUseCase {
  constructor(
    private readonly audioAnalysisStructure: IAudioAnalysisStructure,
    private readonly musicTrackRepository: IMusicTrackRepository,
    private readonly scanProgressPublisher: IScanProgressPublisher,
    loggerFactory: { createLogger: (name: string) => ILogger },
    private readonly logger: ILogger,
    private readonly scanSessionRepository: IScanSessionRepository,
    private readonly musicLibraryRepository: IMusicLibraryRepository,
  ) {
    this.logger = loggerFactory.createLogger('ProcessBatchAudioScanUseCase');
  }

  async execute(data: AudioScanBatchJobData): Promise<{
    isBatchComplete: boolean;
    analysisResults: AudioAnalysisResponse[];
    files: AudioFile[];
    createdTracks: MusicTrack[];
  }> {
    this.logger.info('Processing batch audio scan', { data });
    const { audioFiles, sessionId, batchIndex, totalFiles, libraryId } = data;
    try {
      // Validate all files exist
      const validJobs: AudioFile[] = [];

      for (const audioFile of audioFiles) {
        const { filePath, fileName, trackIndex, libraryId } = audioFile;

        if (!fs.existsSync(filePath)) {
          this.logger.warn(`Skipping missing file: ${filePath} (${fileName})`);
          continue;
        }

        // Check if track already exists and is completed
        const existingTrack =
          await this.musicTrackRepository.getOneByFilePath(filePath);
        if (
          existingTrack &&
          existingTrack.analysisInfo.status ===
            AudioFileAnalysisStatusEnum.COMPLETED
        ) {
          if (
            existingTrack.metadata?.genres?.length !== 0 &&
            existingTrack.metadata?.subgenres?.length !== 0
          ) {
            this.logger.info(`Track already analyzed: ${fileName}`);
            if (sessionId) {
              const trackCompleteEvent: TrackCompleteEvent = {
                type: 'track.complete',
                sessionId,
                timestamp: new Date().toISOString(),
                libraryId,
                batchIndex,
                data: {
                  trackIndex,
                  totalTracks: totalFiles,
                  fileName,
                  success: false,
                },
              };
              await this.scanProgressPublisher.publishEvent(
                sessionId,
                trackCompleteEvent,
              );
            }
            continue;
          }
        }

        validJobs.push(audioFile);
      }

      if (validJobs.length === 0) {
        this.logger.info('No files to process in batch');

        return {
          isBatchComplete: true,
          files: [],
          analysisResults: [],
          createdTracks: [],
        };
      }

      this.logger.info(
        `Processing ${validJobs.length} files in batch (${audioFiles.length - validJobs.length} skipped)`,
      );

      // Create or update all tracks first
      const newTracks = await Promise.all(
        validJobs.map((jobData) =>
          this.musicTrackRepository.upsertOne({
            filePath: jobData.filePath,
            libraryId: jobData.libraryId,
            fileName: jobData.fileName,
            fileSize: jobData.fileSize,
            analysisStatus: AudioFileAnalysisStatusEnum.PROCESSING,
            analysisStartedAt: new Date(),
            duration: 0, // Will be updated after analysis
            format: jobData.extension.toLowerCase().substring(1),
            fileCreatedAt: jobData.lastModified,
          }),
        ),
      );

      // TODO : Filter out tracks that are already in PROCESSING status
      const result = await this.audioAnalysisStructure.analyzeAudioBatch(
        validJobs.map((jobData) => jobData.filePath),
        sessionId,
        batchIndex,
      );
      this.logger.debug(`Analyzed ${result.results.length} files in batch`, {
        result,
      });
      return {
        isBatchComplete: false,
        files: validJobs,
        analysisResults: result.results,
        createdTracks: newTracks,
      };
    } catch (error) {
      this.logger.error(`Failed to process batch audio scan:`, {
        error: error.message,
        errorStack: error.stack,
      });
      await this.scanSessionRepository.deleteSession(sessionId);
      await this.musicLibraryRepository.updateScanStatus(
        libraryId,
        ScanStatusEnum.IDLE,
        false,
      );
      throw error;
    }
  }
}
