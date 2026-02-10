import fs from 'fs';
import { IMusicTrackRepository } from 'src/clean-arch/application/ports/repositories/IMusicTrackRepository';
import {
  AudioFileAnalysisStatusEnum,
  MusicTrack,
} from 'src/clean-arch/kernel/types';
import { AudioAnalysisResponse } from '../../ports/dtos/AudioAnalysis';
import {
  AudioFile,
  AudioScanBatchJobData,
} from '../../ports/dtos/JobSchedulersData';
import { TrackCompleteEvent } from '../../ports/dtos/ScanProgress.types';
import { IAudioAnalysisStructure } from '../../ports/infrastructure/IAudioAnalysisStructure';
import { IScanProgressPublisher } from '../../ports/infrastructure/IScanProgressPublisher';

export class ProcessBatchAudioScanUseCase {
  constructor(
    private readonly audioAnalysisStructure: IAudioAnalysisStructure,
    private readonly musicTrackRepository: IMusicTrackRepository,
    private readonly scanProgressPublisher: IScanProgressPublisher,
  ) {}

  async execute(data: AudioScanBatchJobData): Promise<{
    isBatchComplete: boolean;
    analysisResults: AudioAnalysisResponse[];
    files: AudioFile[];
    createdTracks: MusicTrack[];
  }> {
    const { audioFiles, sessionId, batchIndex, totalFiles } = data;
    // Validate all files exist
    const validJobs: AudioFile[] = [];

    for (const audioFile of audioFiles) {
      const { filePath, fileName, trackIndex, libraryId } = audioFile;

      if (!fs.existsSync(filePath)) {
        console.warn(`Skipping missing file: ${filePath} (${fileName})`);
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
          console.log(`Track already analyzed: ${fileName}`);
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
      console.log('No files to process in batch');

      return {
        isBatchComplete: true,
        files: [],
        analysisResults: [],
        createdTracks: [],
      };
    }

    console.log(
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
    return {
      isBatchComplete: false,
      files: validJobs,
      analysisResults: result.results,
      createdTracks: newTracks,
    };
  }
}
