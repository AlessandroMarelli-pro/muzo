import { ILogger } from 'src/application/ports/infrastructure/ILogger';
import { IMusicTrackRepository } from 'src/application/ports/repositories/IMusicTrackRepository';
import { AudioFileAnalysisStatusEnum, MusicTrack } from 'src/kernel/types';
import { AudioAnalysisResponse } from '../../ports/dtos/AudioAnalysis';
import { AudioFile, AudioScanBatchJobData } from '../../ports/dtos/JobSchedulersData';
import { TrackAlreadyAnalyzedEvent } from '../../ports/dtos/ScanProgress.types';
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
    const { audioFiles, sessionId, batchIndex, libraryId: _libraryId, force } = data;

    try {
      let validJobs: AudioFile[];

      if (force) {
        validJobs = [...audioFiles];
        this.logger.info('Force flag set: re-analyzing all files in batch', {
          count: audioFiles.length,
        });
      } else {
        const areFilesAnalyzed = await this.musicTrackRepository.areFilesAnalyzed(
          audioFiles.map((audioFile) => audioFile.filePath),
        );

        const alreadyAnalyzedFiles = areFilesAnalyzed
          .filter((file) => file.isAnalyzed)
          .map((file) => file.filePath);

        if (alreadyAnalyzedFiles.length > 0) {
          this.logger.info(`${alreadyAnalyzedFiles.length} files are already analyzed`, {
            alreadyAnalyzedFiles,
          });
          const trackAlreadyAnalyzedEvent: TrackAlreadyAnalyzedEvent = {
            type: 'tracks.already.analyzed',
            sessionId,
            timestamp: new Date().toISOString(),
            batchIndex,
            data: {
              fileName: alreadyAnalyzedFiles.join(', '),
            },
          };
          if (sessionId) {
            await this.scanProgressPublisher.publishEvent(sessionId, trackAlreadyAnalyzedEvent);
          }
        }

        validJobs = audioFiles.filter(
          (file) => !alreadyAnalyzedFiles.includes(file.filePath),
        );
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

      throw error;
    }
  }
}
