import { HttpService } from '@nestjs/axios';
import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
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
    this.aiServiceConfig =
      this.configService.get<AiServiceConfig>('aiService')!;
  }

  async analyzeAudioBatch(
    audioFilePaths: string[],
    sessionId?: string,
    batchIndex?: number,
    skipImageSearch?: boolean,
  ): Promise<AudioAnalysisBatchResponse> {
    try {
      // Validate all files exist and are accessible
      for (const audioFilePath of audioFilePaths) {
        if (!fs.existsSync(audioFilePath)) {
          throw new HttpException(
            `Audio file not found: ${audioFilePath}`,
            HttpStatus.NOT_FOUND,
          );
        }

        // Validate file extension
        const fileExtension = path.extname(audioFilePath).toLowerCase();
        const supportedExtensions = [
          '.wav',
          '.mp3',
          '.flac',
          '.m4a',
          '.aac',
          '.ogg',
          '.opus',
        ];
        if (!supportedExtensions.includes(fileExtension)) {
          throw new HttpException(
            `Unsupported audio format: ${fileExtension}`,
            HttpStatus.BAD_REQUEST,
          );
        }
      }

      this.logger.log(
        `Analyzing ${audioFilePaths.length} audio files in batch`,
      );

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

      // Add session ID and batch index for progress tracking
      if (sessionId) {
        formData.append('session_id', sessionId);
      }
      if (batchIndex !== undefined) {
        formData.append('batch_index', batchIndex.toString());
      }

      // Make request to batch endpoint
      const response = await firstValueFrom(
        this.httpService.post(
          `${simpleInstance.url}/api/v1/audio/analyze/batch`,
          formData,
          {
            headers: {
              ...formData.getHeaders(),
            },
            timeout: this.aiServiceConfig.timeout * audioFilePaths.length, // Increase timeout for batch
          },
        ),
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
}
