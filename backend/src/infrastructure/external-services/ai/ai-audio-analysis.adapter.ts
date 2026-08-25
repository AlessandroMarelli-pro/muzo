import { HttpService } from '@nestjs/axios';
import { HttpException, HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import FormData from 'form-data';
import fs from 'fs';
import { firstValueFrom } from 'rxjs';
import { AudioAnalysisBatchResponse } from 'src/application/ports/dtos/AudioAnalysis';
import {
  AI_SERVICE_POOL,
  IAiServicePool,
} from 'src/application/ports/infrastructure/IAiServicePool';
import { IAudioAnalysisStructure } from 'src/application/ports/infrastructure/IAudioAnalysisStructure';
import { AiServiceConfig } from 'src/config';

@Injectable()
export class AiAudioAnalysisAdapter implements IAudioAnalysisStructure {
  private readonly logger = new Logger(AiAudioAnalysisAdapter.name);

  private readonly aiServiceConfig: AiServiceConfig;
  constructor(
    @Inject(AI_SERVICE_POOL)
    private readonly aiServicePool: IAiServicePool,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.aiServiceConfig = this.configService.get<AiServiceConfig>('aiService')!;
  }

  async analyzeAudioBatch(
    audioFilePaths: string[],
    sessionId?: string,
    batchIndex?: number,
    skipImageSearch?: boolean,
    skipAiMetadata?: boolean,
  ): Promise<AudioAnalysisBatchResponse> {
    try {
      this.logger.log(`Analyzing ${audioFilePaths.length} audio files in batch`);

      // Get assigned simple server
      const simpleInstance = this.aiServicePool.getAssignedServer('simple');

      // Create form data with multiple files
      const formData = new FormData();
      for (const audioFilePath of audioFilePaths) {
        formData.append('audio_files', fs.createReadStream(audioFilePath));
      }

      if (skipImageSearch) {
        formData.append('has_image', 'true');
      }

      if (skipAiMetadata) {
        formData.append('skip_ai_metadata', 'true');
      }

      // Add session ID and batch index for progress tracking
      if (sessionId) {
        formData.append('session_id', sessionId);
      }
      if (batchIndex !== undefined) {
        formData.append('batch_index', batchIndex.toString());
      }

      // Make request to batch endpoint
      const response = await firstValueFrom(
        this.httpService.post(`${simpleInstance.url}/api/v1/audio/analyze/batch`, formData, {
          headers: {
            ...formData.getHeaders(),
          },
          timeout: this.aiServiceConfig.timeout * audioFilePaths.length, // Increase timeout for batch
        }),
      );

      this.logger.log(
        `Batch audio analysis completed: ${response.data.successful}/${response.data.total_files} successful`,
      );

      return response.data;
    } catch (error) {
      this.logger.error(`Batch audio analysis failed:`, error.message);

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        `Batch audio analysis failed: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async extractDiscogsEmbedding(audioFilePath: string): Promise<{ embedding: number[] }> {
    try {
      const simpleInstance = this.aiServicePool.getAssignedServer('simple');

      const formData = new FormData();
      formData.append('audio_file', fs.createReadStream(audioFilePath));

      const response = await firstValueFrom(
        this.httpService.post(`${simpleInstance.url}/api/v1/audio/embedding/discogs`, formData, {
          headers: {
            ...formData.getHeaders(),
          },
          timeout: this.aiServiceConfig.timeout,
        }),
      );

      return { embedding: response.data.embedding ?? [] };
    } catch (error) {
      this.logger.error(`Discogs embedding extraction failed:`, error.message);

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        `Discogs embedding extraction failed: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
