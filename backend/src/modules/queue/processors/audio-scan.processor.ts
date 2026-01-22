import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { AnalysisStatus, ScanStatus } from '@prisma/client';
import { Job, Queue } from 'bullmq';
import { isDate } from 'class-validator';
import * as fs from 'fs';
import * as path from 'path';
import {
  AIMetadataResponse,
  SimpleAudioAnalysisResponse,
} from 'src/modules/ai-integration/ai-service-simple.types';
import { ImageService } from 'src/modules/image/image.service';
import { ElasticsearchSyncService } from 'src/modules/recommendation/services/elasticsearch-sync.service';
import { AiIntegrationService } from '../../../modules/ai-integration/ai-integration.service';
import { PrismaService } from '../../../shared/services/prisma.service';
import { ProgressTrackingService } from '../progress-tracking.service';
import {
  AIMetadataJobData,
  AudioScanBatchJobData,
  AudioScanJobData,
  EndScanLibraryJobData,
} from '../queue.service';
import { ScanProgressPubSubService } from '../scan-progress-pubsub.service';
import {
  BatchCompleteEvent,
  ScanErrorEvent,
  TrackCompleteEvent
} from '../scan-progress.types';
import { ScanSessionService } from '../scan-session.service';

@Processor('audio-scan')
export class AudioScanProcessor extends WorkerHost {
  private readonly logger = new Logger(AudioScanProcessor.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly aiIntegrationService: AiIntegrationService,
    private readonly progressTrackingService: ProgressTrackingService,
    @InjectQueue('audio-scan')
    private readonly audioScanQueue: Queue<
      AudioScanJobData | EndScanLibraryJobData
    >,
    private readonly imageService: ImageService,
    private readonly elasticsearchSyncService: ElasticsearchSyncService,
    private readonly pubSubService: ScanProgressPubSubService,
    private readonly scanSessionService: ScanSessionService,
  ) {
    super();
  }

  async process(
    job: Job<AudioScanJobData | EndScanLibraryJobData | AIMetadataJobData | AudioScanJobData[]>,
  ): Promise<void> {
    if (job.name === 'end-scan-library') {
      await this.processEndScanLibrary(job as Job<EndScanLibraryJobData>);
    } else if (job.name === 'extract-ai-metadata') {
      await this.processAIMetadataExtraction(job as Job<AIMetadataJobData>);
    } else if (job.name === 'audio-scan-batch') {
      await this.processAudioScanBatch(job as unknown as Job<AudioScanBatchJobData>);
    }
  }

  /**
   * Process batch audio scan job
   */
  private async processAudioScanBatch(
    job: Job<AudioScanBatchJobData>,
  ): Promise<void> {
    const jobs = job.data;
    const { audioFiles, skipImageSearch, forced, sessionId, totalFiles, totalBatches, batchIndex, libraryId, } = jobs;
    const progression = Math.round(((batchIndex) / totalBatches!) * 10000) / 100;
    this.logger.log(
      `Starting batch audio scan for ${audioFiles.length} files in library ${libraryId} (${batchIndex}/${totalBatches}) - Overall progress: ${progression}%`,
    );



    try {
      // Validate all files exist
      const validJobs: AudioScanJobData[] = [];
      const filePaths: string[] = [];

      for (const jobData of audioFiles) {
        const trackIndex = jobData.trackIndex;

        if (!fs.existsSync(jobData.filePath)) {
          this.logger.warn(
            `Skipping missing file: ${jobData.filePath} (${jobData.fileName})`,
          );
          continue;
        }

        // Check if track already exists and is completed
        const existingTrack = await this.prismaService.musicTrack.findUnique({
          where: { filePath: jobData.filePath },
          include: {
            audioFingerprint: true,
            aiAnalysisResult: true,
            trackGenres: true,
            trackSubgenres: true,
          },
        });
        if (
          existingTrack &&
          existingTrack.analysisStatus === AnalysisStatus.COMPLETED
        ) {
          if (
            existingTrack.trackGenres.length !== 0 &&
            existingTrack.trackSubgenres.length !== 0 &&
            !forced
          ) {
            this.logger.log(`Track already analyzed: ${jobData.fileName}`);
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
                  fileName: jobData.fileName,
                  success: false,
                },
              };
              await this.pubSubService.publishEvent(
                sessionId,
                trackCompleteEvent,
              );
            }
            continue;
          }
        }

        validJobs.push(jobData);
        filePaths.push(jobData.filePath);
      }

      if (validJobs.length === 0) {
        this.logger.log('No files to process in batch');
        await this.batchComplete({ libraryId, job });
        return;
      }

      this.logger.log(
        `Processing ${validJobs.length} files in batch (${audioFiles.length - validJobs.length} skipped)`,
        filePaths
      );

      // Create or update all tracks first
      const tracks = await Promise.all(
        validJobs.map((jobData) =>
          this.createOrUpdateTrack({
            filePath: jobData.filePath,
            libraryId: jobData.libraryId,
            fileName: jobData.fileName,
            fileSize: jobData.fileSize,
            lastModified: jobData.lastModified,
          }),
        ),
      );

      // Update all tracks to PROCESSING status
      await Promise.all(
        tracks.map((track) =>
          this.prismaService.musicTrack.update({
            where: { id: track.id },
            data: {
              analysisStatus: AnalysisStatus.PROCESSING,
              analysisStartedAt: new Date(),
            },
          }),
        ),
      );

      // Analyze all files in batch
      const batchAnalysisResult = await this.aiIntegrationService.analyzeAudioBatch(
        filePaths,
        skipImageSearch,
        sessionId,
        batchIndex,
      );

      // Process each result
      let successful = 0;
      let failed = 0;

      for (let i = 0; i < validJobs.length; i++) {
        const jobData = validJobs[i];
        const trackIndex = jobData.trackIndex;
        const track = tracks[i];
        const analysisResult = batchAnalysisResult.results[i];

        try {
          // Check if analysis was successful
          if (!analysisResult || analysisResult.status === 'error') {
            throw new Error(
              analysisResult?.message || 'Analysis failed for this file',
            );
          }

          // Validate required fields
          if (
            !analysisResult?.id3_tags?.artist &&
            !analysisResult?.id3_tags?.title &&
            !analysisResult?.ai_metadata?.artist &&
            !analysisResult?.ai_metadata?.title
          ) {
            this.logger.log(
              `Skipping audio scan for ${jobData.fileName} because it has no artist or title. Music track deleted.`,
            );
            await this.prismaService.musicTrack.delete({
              where: { id: track.id },
            });
            failed++;

            // Publish track failure event
            if (sessionId) {
              const trackCompleteEvent: TrackCompleteEvent = {
                type: 'track.complete',
                sessionId,
                timestamp: new Date().toISOString(),
                libraryId,
                batchIndex,
                data: {
                  totalTracks: totalFiles,
                  trackIndex,
                  fileName: jobData.fileName,
                  success: false,
                },
              };
              await this.pubSubService.publishEvent(
                sessionId,
                trackCompleteEvent,
              );
            }
            continue;
          }



          // Process this track using extracted helper methods
          await this.processTrackAnalysis(track.id, analysisResult);

          successful++;
          this.logger.log(
            `Successfully analyzed audio file: ${jobData.fileName}`,
          );

          // Publish track complete event
          if (sessionId) {
            const trackCompleteEvent: TrackCompleteEvent = {
              type: 'track.complete',
              sessionId,
              timestamp: new Date().toISOString(),
              libraryId,
              batchIndex,
              data: {
                totalTracks: totalFiles,
                trackIndex,
                fileName: jobData.fileName,
                success: true,
              },
            };
            await this.pubSubService.publishEvent(
              sessionId,
              trackCompleteEvent,
            );
          }
        } catch (error) {
          failed++;
          this.logger.error(
            `Failed to process track ${jobData.fileName}:`,
            error.message,
          );

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
                details: { fileName: jobData.fileName },
              },
            };
            await this.pubSubService.publishError(sessionId, errorEvent);
          }

          // Update track with error status
          try {
            await this.prismaService.musicTrack.update({
              where: { id: track.id },
              data: {
                analysisStatus: AnalysisStatus.FAILED,
                analysisError: error.message,
              },
            });
          } catch (updateError) {
            this.logger.error(
              'Failed to update track error status:',
              updateError.message,
            );
          }
        }
      }

      await this.batchComplete({ libraryId, job });

    } catch (error) {
      this.logger.error(`Batch audio scan failed:`, error.message);
      throw error;
    }
  }
  private async batchComplete({ libraryId, job }: { libraryId, job: Job<AudioScanBatchJobData> }): Promise<void> {
    const { totalFiles, totalBatches, audioFiles } = job.data;
    const progressPercentage = Math.round(((1) / totalBatches!) * 10000) / 100;
    // Update session progress
    const session = await this.scanSessionService.updateSessionProgress(libraryId, {
      completedBatches: 1,
      progressPercentage,
      completedTracks: audioFiles.length,
    });
    const isComplete = session.completedBatches === session.totalBatches;
    const batchCompleteEvent: BatchCompleteEvent = {
      type: 'batch.complete',
      sessionId: libraryId,
      timestamp: new Date().toISOString(),
      libraryId,
      batchIndex: 1,
      data: {
        successful: totalFiles,
        failed: 0,
        totalTracks: totalFiles,
      },
      overallProgress: isComplete ? 100 : session.overallProgress
    };

    this.logger.debug(
      `Progress update for ${libraryId}: ${session.completedBatches}/${session.totalBatches} (${session.overallProgress.toFixed(1)}%)`,
    );
    await this.pubSubService.publishEvent(libraryId, batchCompleteEvent);


    // Update progress tracking
    const library = await this.prismaService.musicLibrary.findUnique({
      where: { id: libraryId },
      select: { name: true },
    });
    if (library) {
      await this.progressTrackingService.updateLibraryProgress(
        libraryId,
        library.name,
        job,
        isComplete
      );
    }
    // Update job progress
    await job.updateProgress(100);

  }

  /**
   * Process a single track's analysis result (extracted common logic)
   */
  private async processTrackAnalysis(
    trackId: string,
    analysisResult: SimpleAudioAnalysisResponse,
  ): Promise<void> {
    // Create AudioFingerprint record
    const fingerprint = await this.createAudioFingerprint(
      trackId,
      analysisResult,
    );

    // Create AIAnalysisResult record
    await this.createAIAnalysisResult(trackId, fingerprint.id, analysisResult);

    // Update track with analysis results
    await this.updateTrackWithAnalysis(trackId, analysisResult);

    // Update track with AI metadata if available
    if (analysisResult.ai_metadata) {
      await this.updateTrackWithAIMetadata(trackId, analysisResult.ai_metadata);
    }

    // Update analysis status to COMPLETED
    await this.prismaService.musicTrack.update({
      where: { id: trackId },
      data: {
        hasMusicbrainz:
          analysisResult?.hierarchical_classification?.musicbrainz_validation
            ?.used || false,
        hasDiscogs:
          analysisResult?.hierarchical_classification?.discogs_validation
            ?.used || false,
        analysisStatus: AnalysisStatus.COMPLETED,
        analysisCompletedAt: new Date(),
      },
    });

    // Sync with Elasticsearch
    await this.elasticsearchSyncService.syncTrackOnUpdate(trackId);

    // Search for image if available
    if (
      analysisResult.album_art?.imageUrl ||
      analysisResult.album_art?.imagePath
    ) {
      await this.imageService.addImageSearchRecord(
        trackId,
        analysisResult.album_art,
      );
    }
  }

  /**
   * Process end-scan-library job
   */
  private async processEndScanLibrary(
    job: Job<EndScanLibraryJobData>,
  ): Promise<void> {
    const { libraryId, libraryName, totalTracks, scanType } = job.data;

    this.logger.log(`Processing end-scan-library for: ${libraryName}`);

    try {
      // Get current library statistics
      const library = await this.prismaService.musicLibrary.findUnique({
        where: { id: libraryId },
        include: {
          tracks: {
            select: {
              analysisStatus: true,
            },
          },
        },
      });

      if (!library) {
        throw new Error(`Library not found: ${libraryId}`);
      }

      // Calculate current statistics
      const analyzedTracks = library.tracks.filter(
        (track) => track.analysisStatus === AnalysisStatus.COMPLETED,
      ).length;

      const pendingTracks = library.tracks.filter(
        (track) => track.analysisStatus === AnalysisStatus.PENDING,
      ).length;

      const failedTracks = library.tracks.filter(
        (track) => track.analysisStatus === AnalysisStatus.FAILED,
      ).length;

      // Update library with final statistics
      const updateData: any = {
        totalTracks,
        analyzedTracks,
        pendingTracks,
        failedTracks,
        scanStatus: ScanStatus.IDLE,
      };

      // Update appropriate scan timestamp
      if (scanType === 'full') {
        updateData.lastScanAt = new Date();
      } else {
        updateData.lastIncrementalScanAt = new Date();
      }

      await this.prismaService.musicLibrary.update({
        where: { id: libraryId },
        data: updateData,
      });

      this.logger.log(
        `Completed library scan for ${libraryName}: ${analyzedTracks}/${totalTracks} analyzed, ${failedTracks} failed, ${pendingTracks} pending`,
      );

      // Update job progress
      await job.updateProgress(100);
    } catch (error) {
      this.logger.error(
        `End-scan-library failed for ${libraryName}:`,
        error.message,
      );

      // Update library status to ERROR
      try {
        await this.prismaService.musicLibrary.update({
          where: { id: libraryId },
          data: {
            scanStatus: ScanStatus.ERROR,
          },
        });
      } catch (updateError) {
        this.logger.error(
          'Failed to update library error status:',
          updateError.message,
        );
      }

      throw error;
    }
  }

  /**
   * Create or update MusicTrack record
   */
  private async createOrUpdateTrack(data: {
    filePath: string;
    libraryId: string;
    fileName: string;
    fileSize: number;
    lastModified: Date;
  }) {
    const { filePath, libraryId, fileName, fileSize, lastModified } = data;

    return await this.prismaService.musicTrack.upsert({
      where: { filePath },
      update: {
        fileName,
        fileSize,
        libraryId,
        analysisStatus: AnalysisStatus.PENDING,
      },
      create: {
        filePath,
        fileName,
        fileSize,
        libraryId,
        duration: 0, // Will be updated after analysis
        format: path.extname(fileName).toLowerCase().substring(1),
        analysisStatus: AnalysisStatus.PENDING,
        fileCreatedAt: lastModified,
      },
    });
  }

  /**
   * Create AudioFingerprint record
   */
  private async createAudioFingerprint(
    trackId: string,
    analysisResult: SimpleAudioAnalysisResponse,
  ) {
    const features = analysisResult.features;
    const melodicFingerprint = features?.melodic_fingerprint;
    const spectralFeatures = features?.spectral_features;
    const musicalFeatures = features?.musical_features;
    const fingerprint = analysisResult.fingerprint;
    const fingerprintData = {
      trackId,
      mfcc: JSON.stringify(spectralFeatures?.mfcc_mean || []),
      spectralCentroid: JSON.stringify(
        spectralFeatures?.spectral_centroids || {},
      ),
      spectralRolloff: JSON.stringify(
        spectralFeatures?.spectral_rolloffs || {},
      ),
      spectralContrast: JSON.stringify([]),
      chroma: JSON.stringify(melodicFingerprint?.chroma || {}),
      spectralSpread: JSON.stringify(spectralFeatures?.spectral_spreads || {}),
      spectralBandwith: JSON.stringify(
        spectralFeatures?.spectral_bandwidths || {},
      ),
      spectralFlatness: JSON.stringify(
        spectralFeatures?.spectral_flatnesses || {},
      ),
      zeroCrossingRate: JSON.stringify(
        spectralFeatures?.zero_crossing_rate || {},
      ),
      tempo: musicalFeatures?.tempo || 0,
      key: musicalFeatures?.key || null,

      valence: musicalFeatures?.valence || 0,
      danceability: musicalFeatures?.danceability || 0,
      arousal: musicalFeatures?.arousal || 0,
      acousticness: musicalFeatures?.acousticness || 0,
      instrumentalness: musicalFeatures?.instrumentalness || 0,
      speechiness: musicalFeatures?.speechiness || 0,
      liveness: musicalFeatures?.liveness || 0,
      audioHash: fingerprint.audio_hash || '',
      fileHash: fingerprint.file_hash || '',
      tonnetz: JSON.stringify(melodicFingerprint?.tonnetz || {}),
      camelotKey: musicalFeatures?.camelot_key || '',
      valenceMood: musicalFeatures?.valence_mood || '',
      arousalMood: musicalFeatures?.arousal_mood || '',
      danceabilityFeeling: musicalFeatures?.danceability_feeling || '',
      rhythmStability:
        musicalFeatures?.danceability_calculation?.rhythm_stability || 0,
      bassPresence:
        musicalFeatures?.danceability_calculation?.bass_presence || 0,
      tempoRegularity:
        musicalFeatures?.danceability_calculation?.tempo_regularity || 0,
      tempoAppropriateness:
        musicalFeatures?.danceability_calculation?.tempo_appropriateness || 0,
      energyFactor:
        musicalFeatures?.danceability_calculation?.energy_factor || 0,
      syncopation: musicalFeatures?.danceability_calculation?.syncopation || 0,
      modeFactor: musicalFeatures?.mood_calculation?.mode_factor || 0,
      modeConfidence: musicalFeatures?.mood_calculation?.mode_confidence || 0,
      modeWeight: musicalFeatures?.mood_calculation?.mode_weight || 0,
      tempoFactor: musicalFeatures?.mood_calculation?.tempo_factor || 0,
      brightnessFactor:
        musicalFeatures?.mood_calculation?.brightness_factor || 0,
    };

    return await this.prismaService.audioFingerprint.upsert({
      where: { trackId },
      update: fingerprintData,
      create: fingerprintData,
    });
  }

  /**
   * Create AIAnalysisResult record
   */
  private async createAIAnalysisResult(
    trackId: string,
    fingerprintId: string,
    analysisResult: SimpleAudioAnalysisResponse,
  ) {
    const aiAnalysisData = {
      trackId,
      fingerprintId,
      genreClassification: JSON.stringify(
        analysisResult.hierarchical_classification?.classification?.genre || {},
      ),
      artistSuggestion: null,
      albumSuggestion: null,
      processingTime:
        analysisResult.hierarchical_classification?.processing_time || 0,
      errorMessage: null,
      modelVersion:
        analysisResult.hierarchical_classification?.details?.genre_details
          ?.model_name || '1.0',
    };

    return await this.prismaService.aIAnalysisResult.upsert({
      where: { trackId },
      update: aiAnalysisData,
      create: aiAnalysisData,
    });
  }

  /**
   * Update track with analysis results
   */
  private async updateTrackWithAnalysis(
    trackId: string,
    analysisResult: SimpleAudioAnalysisResponse,
  ) {
    const updateData: any = {};

    // Update duration if available
    if (analysisResult.audio_technical.duration_seconds) {
      updateData.duration = analysisResult.audio_technical.duration_seconds;
    }

    // Update audio format details
    if (analysisResult.audio_technical.format) {
      updateData.format = analysisResult.audio_technical.format;
    }
    if (analysisResult.audio_technical.bitrate) {
      updateData.bitrate = analysisResult.audio_technical.bitrate;
    }
    if (analysisResult.audio_technical.sample_rate) {
      updateData.sampleRate = analysisResult.audio_technical.sample_rate;
    }

    // Update AI-generated metadata
    let genreNames: string[] = [];
    let subgenreNames: string[] = [];

    if (analysisResult.hierarchical_classification?.classification) {
      if (analysisResult.hierarchical_classification.classification.genre) {
        genreNames.push(
          analysisResult.hierarchical_classification.classification.genre,
        );
      }
      if (analysisResult.hierarchical_classification.classification.subgenre) {
        subgenreNames.push(
          analysisResult.hierarchical_classification.classification.subgenre,
        );
      }
    }

    if (
      analysisResult.hierarchical_classification?.classification?.confidence
    ) {
      updateData.aiConfidence =
        analysisResult.hierarchical_classification.classification.confidence.genre;
      updateData.aiSubgenreConfidence =
        analysisResult.hierarchical_classification.classification.confidence.subgenre;
    }

    // Update original metadata if available
    if (analysisResult.id3_tags) {
      if (analysisResult.id3_tags.title) {
        updateData.originalTitle = analysisResult.id3_tags.title;
      }
      if (analysisResult.id3_tags.artist) {
        updateData.originalArtist = analysisResult.id3_tags.artist;
      }
      if (analysisResult.id3_tags.album) {
        updateData.originalAlbum = analysisResult.id3_tags.album;
      }
      if (analysisResult.id3_tags.genre) {
        // Add original genre to the list
        genreNames.push(analysisResult.id3_tags.genre);
      }
      if (analysisResult.id3_tags.albumartist) {
        updateData.originalAlbumartist = analysisResult.id3_tags.albumartist;
      }
      if (
        analysisResult.id3_tags.date &&
        isDate(new Date(analysisResult.id3_tags.date))
      ) {
        updateData.originalDate = new Date(analysisResult.id3_tags.date);
      }

      if (analysisResult.id3_tags.bpm) {
        updateData.originalBpm = parseInt(analysisResult.id3_tags.bpm, 10);
      }
      if (analysisResult.id3_tags.track_number) {
        updateData.originalTrack_number = parseInt(
          analysisResult.id3_tags.track_number,
          10,
        );
      }
      if (analysisResult.id3_tags.disc_number) {
        updateData.originalDisc_number = analysisResult.id3_tags.disc_number;
      }

      if (analysisResult.id3_tags.year) {
        // Parse originalYear to support both YYYY and YYYYMMDD formats
        let parsedOriginalYear: number | null = null;

        const year = analysisResult.id3_tags.year;
        if (/^\d{8}$/.test(year)) {
          // Format: YYYYMMDD
          parsedOriginalYear = parseInt(year.substring(0, 4), 10);
        } else if (/^\d{4}$/.test(year)) {
          // Format: YYYY
          parsedOriginalYear = parseInt(year, 10);
        } else {
          // Fallback: try to parse as number
          parsedOriginalYear = parseInt(year, 10) || null;
        }

        updateData.originalYear = parsedOriginalYear;
      }

      if (analysisResult.id3_tags.comment) {
        updateData.originalComment = analysisResult.id3_tags.comment;
      }
      if (analysisResult.id3_tags.composer) {
        updateData.originalComposer = analysisResult.id3_tags.composer;
      }
      if (analysisResult.id3_tags.copyright) {
        updateData.originalCopyright = analysisResult.id3_tags.copyright;
      }
    }

    const updatedTrack = await this.prismaService.musicTrack.update({
      where: { id: trackId },
      data: {
        ...updateData,
        analysisCompletedAt: new Date(),
        analysisError: null,
      },
    });
    // Update genres and subgenres
    if (genreNames.length > 0) {
      await this.updateTrackGenres(trackId, genreNames);
    }
    if (subgenreNames.length > 0) {
      await this.updateTrackSubgenres(trackId, subgenreNames);
    }

    return updatedTrack;
  }

  /**
   * Process AI metadata extraction job
   */
  private async processAIMetadataExtraction(
    job: Job<AIMetadataJobData>,
  ): Promise<void> {
    const { trackId, filePath, fileName, libraryId, index, totalFiles } =
      job.data;

    this.logger.log(
      `Starting AI metadata extraction for: ${fileName} (${index !== undefined ? `${index + 1}/${totalFiles}` : 'single'})`,
    );

    try {
      // Get track from database
      const track = await this.prismaService.musicTrack.findUnique({
        where: { id: trackId },
      });

      if (!track) {
        throw new Error(`Track not found: ${trackId}`);
      }

      // Extract metadata using AI (pass both filename and file_path for ID3 tag extraction)
      const aiMetadata = await this.aiIntegrationService.extractMetadataWithAI(
        fileName,
        filePath,
      );
      // Update track with AI metadata
      await this.updateTrackWithAIMetadata(track.id, aiMetadata.metadata);

      this.logger.log(`Successfully extracted AI metadata for: ${fileName}`);

      // Update job progress
      await job.updateProgress(100);
    } catch (error) {
      this.logger.error(
        `AI metadata extraction failed for ${fileName}:`,
        error.message,
      );

      // Update track with error status if it exists
      try {
        const track = await this.prismaService.musicTrack.findUnique({
          where: { id: trackId },
        });

        if (track) {
          await this.prismaService.musicTrack.update({
            where: { id: track.id },
            data: {
              analysisError: `AI metadata extraction failed: ${error.message}`,
            },
          });
        }
      } catch (updateError) {
        this.logger.error(
          'Failed to update track error status:',
          updateError.message,
        );
      }

      throw error;
    }
  }

  /**
   * Update track with AI metadata
   */
  private async updateTrackWithAIMetadata(
    trackId: string,
    aiMetadata: AIMetadataResponse['metadata'],
  ): Promise<void> {
    const metadata = aiMetadata;
    const updateData: any = {};
    // Update AI-generated metadata fields
    if (metadata.artist) {
      updateData.aiArtist = metadata.artist;
      updateData.originalArtist = metadata.artist;
    }
    if (metadata.title) {
      updateData.aiTitle = metadata.title;
      updateData.originalTitle = metadata.title;
      if (metadata.mix) {
        updateData.originalTitle += ` (${metadata.mix})`;
        updateData.aiTitle += ` (${metadata.mix})`;
      }
    }
    if (metadata.description) {
      updateData.aiDescription = metadata.description;
    }

    // Parse year if available
    if (metadata.year) {
      const yearStr = String(metadata.year);
      const yearMatch = yearStr.match(/^\d{4}/);
      if (yearMatch) {
        updateData.originalYear = parseInt(yearMatch[0], 10);
      }
    }

    // Store additional metadata in userTags as JSON (if tags exist)
    if (metadata.tags && metadata.tags.length > 0) {
      updateData.aiTags = JSON.stringify(metadata.tags);
    }

    // Store audioFeatures data
    if (metadata.audioFeatures) {
      if (metadata.audioFeatures.vocals) {
        updateData.vocalsDesc = metadata.audioFeatures.vocals;
      }
      if (
        metadata.audioFeatures.atmosphere &&
        metadata.audioFeatures.atmosphere.length > 0
      ) {
        updateData.atmosphereDesc = JSON.stringify(
          metadata.audioFeatures.atmosphere,
        );
      }
    }

    // Store context data
    if (metadata.context) {
      if (metadata.context.background) {
        updateData.contextBackground = metadata.context.background;
      }
      if (metadata.context.impact) {
        updateData.contextImpact = metadata.context.impact;
      }
    }

    // Update track
    const updatedTrack = await this.prismaService.musicTrack.update({
      where: { id: trackId },
      data: updateData,
    });
    // Update genres and subgenres
    if (metadata.genre && metadata.genre.length > 0) {
      await this.updateTrackGenres(trackId, metadata.genre);
    }
    if (metadata.style && metadata.style.length > 0) {
      await this.updateTrackSubgenres(trackId, metadata.style);
    }
  }

  /**
   * Helper method to update track genres
   */
  private async updateTrackGenres(
    trackId: string,
    genreNames: string[],
  ): Promise<void> {
    // Remove existing genre associations
    await this.prismaService.trackGenre.deleteMany({
      where: { trackId },
    });

    // Create or find genres and associate them
    for (const genreName of genreNames) {
      if (!genreName || genreName.trim() === '') continue;

      // Lowercase the genre name to ensure uniqueness
      const normalizedName = genreName.trim().toLowerCase();

      let genre = await this.prismaService.genre.findUnique({
        where: { name: normalizedName },
      });

      if (!genre) {
        genre = await this.prismaService.genre.create({
          data: { name: normalizedName },
        });
      }

      // Create association (check if it doesn't already exist)
      const existing = await this.prismaService.trackGenre.findUnique({
        where: {
          trackId_genreId: {
            trackId,
            genreId: genre.id,
          },
        },
      });

      if (!existing) {
        await this.prismaService.trackGenre.create({
          data: {
            trackId,
            genreId: genre.id,
          },
        });
      }
    }
  }

  /**
   * Helper method to update track subgenres
   */
  private async updateTrackSubgenres(
    trackId: string,
    subgenreNames: string[],
  ): Promise<void> {
    // Remove existing subgenre associations
    await this.prismaService.trackSubgenre.deleteMany({
      where: { trackId },
    });

    // Create or find subgenres and associate them
    for (const subgenreName of subgenreNames) {
      if (!subgenreName || subgenreName.trim() === '') continue;

      // Lowercase the subgenre name to ensure uniqueness
      const normalizedName = subgenreName.trim().toLowerCase();

      let subgenre = await this.prismaService.subgenre.findUnique({
        where: { name: normalizedName },
      });

      if (!subgenre) {
        subgenre = await this.prismaService.subgenre.create({
          data: { name: normalizedName },
        });
      }

      // Create association (check if it doesn't already exist)
      const existing = await this.prismaService.trackSubgenre.findUnique({
        where: {
          trackId_subgenreId: {
            trackId,
            subgenreId: subgenre.id,
          },
        },
      });

      if (!existing) {
        await this.prismaService.trackSubgenre.create({
          data: {
            trackId,
            subgenreId: subgenre.id,
          },
        });
      }
    }
  }

  /**
   * Handle job failure
   */
  async onFailed(
    job: Job<AudioScanJobData | EndScanLibraryJobData | AIMetadataJobData>,
    error: Error,
  ): Promise<void> {
    if (job.name === 'end-scan-library') {
      const data = job.data as EndScanLibraryJobData;
      this.logger.error(
        `End-scan-library job failed for ${data.libraryName}:`,
        error.message,
      );
    } else {
      const data = job.data as AudioScanJobData;
      this.logger.error(
        `Audio scan job failed for ${data.fileName}:`,
        error.message,
      );
    }
  }

  /**
   * Handle job completion
   */
  async onCompleted(
    job: Job<AudioScanJobData | EndScanLibraryJobData | AIMetadataJobData>,
  ): Promise<void> {
    if (job.name === 'end-scan-library') {
      const data = job.data as EndScanLibraryJobData;
      this.logger.log(`End-scan-library completed for: ${data.libraryName}`);
    } else {
      const data = job.data as AudioScanJobData;
      this.logger.log(`Audio scan completed for: ${data.fileName}`);
    }
  }
}
