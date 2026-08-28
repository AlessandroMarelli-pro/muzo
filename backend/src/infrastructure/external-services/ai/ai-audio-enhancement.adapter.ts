import { HttpService } from '@nestjs/axios';
import { HttpException, HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import { firstValueFrom } from 'rxjs';
import {
  HqAudioEnhanceResult,
  IHqAudioEnhancer,
} from 'src/application/ports/infrastructure/IHqAudioEnhancer';
import {
  AI_SERVICE_POOL,
  IAiServicePool,
} from 'src/application/ports/infrastructure/IAiServicePool';
import { AiServiceConfig } from 'src/config';
import { HqAudioConfig } from 'src/config/hq-audio.config';

@Injectable()
export class AiAudioEnhancementAdapter implements IHqAudioEnhancer {
  private readonly logger = new Logger(AiAudioEnhancementAdapter.name);

  private readonly hqAudioConfig: HqAudioConfig;
  private readonly aiServiceConfig: AiServiceConfig;

  constructor(
    @Inject(AI_SERVICE_POOL)
    private readonly aiServicePool: IAiServicePool,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.hqAudioConfig = this.configService.get<HqAudioConfig>('hqAudio')!;
    this.aiServiceConfig = this.configService.get<AiServiceConfig>('aiService')!;
  }

  private authHeaders(): Record<string, string> {
    return this.aiServiceConfig.authToken
      ? { Authorization: `Bearer ${this.aiServiceConfig.authToken}` }
      : {};
  }

  async enhance(inputFilePath: string, outputDir: string): Promise<HqAudioEnhanceResult> {
    try {
      this.logger.log(`Enhancing audio: ${inputFilePath}`);

      const instance = this.aiServicePool.getAssignedServer('simple');

      const formData = new FormData();
      formData.append('audio_file', fs.createReadStream(inputFilePath));

      const response = await firstValueFrom(
        this.httpService.post(`${instance.url}/api/v1/audio/enhance`, formData, {
          headers: {
            ...formData.getHeaders(),
            ...this.authHeaders(),
          },
          responseType: 'arraybuffer',
          timeout: this.hqAudioConfig.universr.timeoutMs,
        }),
      );

      await fs.promises.mkdir(outputDir, { recursive: true });
      const outputFileName = `${path.basename(
        inputFilePath,
        path.extname(inputFilePath),
      )}-enhanced.wav`;
      const outputFilePath = path.join(outputDir, outputFileName);
      await fs.promises.writeFile(outputFilePath, response.data);

      this.logger.log(`Audio enhancement completed: ${outputFilePath}`);

      return { filePath: outputFilePath };
    } catch (error) {
      this.logger.error(`Audio enhancement failed:`, error.message);

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        `Audio enhancement failed: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
