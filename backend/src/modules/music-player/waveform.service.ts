import { BadRequestException, Injectable } from '@nestjs/common';
import ffmpeg from 'fluent-ffmpeg';
import * as fs from 'fs';
import * as wav from 'node-wav';
import * as path from 'path';

export interface WaveformData {
  peaks: number[];
  duration: number;
  sampleRate: number;
  channels: number;
  bitDepth: number;
}

export interface WaveformOptions {
  width?: number;
  height?: number;
  samplesPerPixel?: number;
  normalize?: boolean;
}

@Injectable()
export class WaveformService {
  private readonly SUPPORTED_FORMATS = [
    '.mp3',
    '.wav',
    '.flac',
    '.m4a',
    '.aac',
    '.ogg',
    '.opus',
  ];
  private readonly DEFAULT_SAMPLES_PER_PIXEL = 100;
  private readonly MAX_WAVEFORM_POINTS = 200;

  async generateWaveform(
    filePath: string,
    options: WaveformOptions = {},
  ): Promise<number[]> {
    if (!fs.existsSync(filePath)) {
      throw new BadRequestException(`Audio file not found: ${filePath}`);
    }

    const fileExtension = path.extname(filePath).toLowerCase();
    if (!this.SUPPORTED_FORMATS.includes(fileExtension)) {
      throw new BadRequestException(
        `Unsupported audio format: ${fileExtension}`,
      );
    }

    const {
      width = this.MAX_WAVEFORM_POINTS,
      samplesPerPixel = this.DEFAULT_SAMPLES_PER_PIXEL,
      normalize = true,
    } = options;

    try {
      // Generate real waveform data using audio analysis
      const waveformData = await this.generateRealWaveform(
        filePath,
        width,
        samplesPerPixel,
      );
      if (normalize) {
        return this.normalizeWaveform(waveformData);
      }

      return waveformData;
    } catch (error) {
      console.error('Error generating waveform:', error);
      // Fallback to mock data if real analysis fails
      console.warn('Falling back to mock waveform data');

      return [];
    }
  }

  async getDetailedWaveformData(filePath: string): Promise<WaveformData> {
    if (!fs.existsSync(filePath)) {
      throw new BadRequestException(`Audio file not found: ${filePath}`);
    }

    try {
      // Mock implementation - in production, use actual audio analysis
      const stats = fs.statSync(filePath);
      const duration = await this.estimateDuration(filePath);

      const peaks = await this.generateWaveform(filePath, {
        width: this.MAX_WAVEFORM_POINTS,
        samplesPerPixel: 50,
        normalize: true,
      });

      return {
        peaks,
        duration,
        sampleRate: 44100, // Default sample rate
        channels: 2, // Default stereo
        bitDepth: 16, // Default bit depth
      };
    } catch (error) {
      console.error('Error getting detailed waveform data:', error);
      throw new BadRequestException('Failed to get detailed waveform data');
    }
  }

  async getWaveformSegment(
    filePath: string,
    startTime: number,
    endTime: number,
    width: number = 1000,
  ): Promise<number[]> {
    if (!fs.existsSync(filePath)) {
      throw new BadRequestException(`Audio file not found: ${filePath}`);
    }

    if (startTime < 0 || endTime <= startTime) {
      throw new BadRequestException('Invalid time range');
    }

    try {
      const duration = await this.estimateDuration(filePath);

      if (endTime > duration) {
        endTime = duration;
      }

      // Generate waveform for the entire file first
      const fullWaveform = await this.generateWaveform(filePath, {
        width: this.MAX_WAVEFORM_POINTS,
        samplesPerPixel: 50,
        normalize: true,
      });

      // Extract segment based on time range
      const startIndex = Math.floor(
        (startTime / duration) * fullWaveform.length,
      );
      const endIndex = Math.floor((endTime / duration) * fullWaveform.length);

      const segment = fullWaveform.slice(startIndex, endIndex);

      // Resample to requested width
      return this.resampleWaveform(segment, width);
    } catch (error) {
      console.error('Error getting waveform segment:', error);
      throw new BadRequestException('Failed to get waveform segment');
    }
  }

  private async generateRealWaveform(
    filePath: string,
    width: number,
    samplesPerPixel: number,
  ): Promise<number[]> {
    return new Promise((resolve, reject) => {
      const tempWavPath = path.join(
        path.dirname(filePath),
        `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.wav`,
      );

      // Convert audio to WAV format for analysis
      ffmpeg(filePath)
        .audioChannels(1) // Convert to mono for simpler analysis
        .audioFrequency(44100) // Standard sample rate
        .audioBitrate('16k') // Lower bitrate for faster processing
        .format('wav')
        .output(tempWavPath)
        .on('end', async () => {
          try {
            // Read the WAV file
            const wavBuffer = fs.readFileSync(tempWavPath);
            const wavData = wav.decode(wavBuffer);

            // Clean up temp file
            fs.unlinkSync(tempWavPath);

            if (
              !wavData ||
              !wavData.channelData ||
              wavData.channelData.length === 0
            ) {
              throw new Error('Invalid WAV data');
            }

            const audioData = wavData.channelData[0]; // Use first channel (mono)
            const sampleRate = wavData.sampleRate;
            const totalSamples = audioData.length;

            // Calculate how many samples to skip for each pixel
            const samplesPerPixelActual = Math.max(
              1,
              Math.floor(totalSamples / width),
            );

            const waveform: number[] = [];

            for (let i = 0; i < width; i++) {
              const startSample = i * samplesPerPixelActual;
              const endSample = Math.min(
                startSample + samplesPerPixelActual,
                totalSamples,
              );

              // Calculate RMS (Root Mean Square) for this segment
              let sumSquares = 0;
              let sampleCount = 0;

              for (let j = startSample; j < endSample; j++) {
                const sample = audioData[j];
                sumSquares += sample * sample;
                sampleCount++;
              }

              const rms =
                sampleCount > 0 ? Math.sqrt(sumSquares / sampleCount) : 0;

              // Normalize to 0-1 range
              const normalizedAmplitude = Math.min(1, Math.max(0, rms));
              waveform.push(normalizedAmplitude);
            }

            resolve(waveform);
          } catch (error) {
            // Clean up temp file on error
            if (fs.existsSync(tempWavPath)) {
              fs.unlinkSync(tempWavPath);
            }
            reject(error);
          }
        })
        .on('error', (error) => {
          // Clean up temp file on error
          if (fs.existsSync(tempWavPath)) {
            fs.unlinkSync(tempWavPath);
          }
          reject(error);
        })
        .run();
    });
  }

  private normalizeWaveform(waveform: number[]): number[] {
    if (waveform.length === 0) return waveform;

    const max = Math.max(...waveform);
    const min = Math.min(...waveform);
    const range = max - min;

    if (range === 0) return waveform.map(() => 0.5);

    return waveform.map((value) => (value - min) / range);
  }

  private resampleWaveform(waveform: number[], targetWidth: number): number[] {
    if (waveform.length === targetWidth) return waveform;

    const resampled: number[] = [];
    const ratio = waveform.length / targetWidth;

    for (let i = 0; i < targetWidth; i++) {
      const sourceIndex = i * ratio;
      const index = Math.floor(sourceIndex);
      const fraction = sourceIndex - index;

      if (index >= waveform.length - 1) {
        resampled.push(waveform[waveform.length - 1]);
      } else {
        // Linear interpolation
        const value =
          waveform[index] + fraction * (waveform[index + 1] - waveform[index]);
        resampled.push(value);
      }
    }

    return resampled;
  }

  private async estimateDuration(filePath: string): Promise<number> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) {
          // Fallback to file size estimation
          const stats = fs.statSync(filePath);
          const fileSizeMB = stats.size / (1024 * 1024);
          const estimatedDuration = Math.max(30, fileSizeMB * 60);
          resolve(estimatedDuration);
          return;
        }

        const duration = metadata.format.duration;
        if (duration && duration > 0) {
          resolve(duration);
        } else {
          // Fallback to file size estimation
          const stats = fs.statSync(filePath);
          const fileSizeMB = stats.size / (1024 * 1024);
          const estimatedDuration = Math.max(30, fileSizeMB * 60);
          resolve(estimatedDuration);
        }
      });
    });
  }

  async getWaveformMetadata(filePath: string): Promise<{
    duration: number;
    sampleRate: number;
    channels: number;
    bitDepth: number;
    format: string;
  }> {
    if (!fs.existsSync(filePath)) {
      throw new BadRequestException(`Audio file not found: ${filePath}`);
    }

    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) {
          // Fallback to default values
          const fileExtension = path.extname(filePath).toLowerCase();
          this.estimateDuration(filePath).then((duration) => {
            resolve({
              duration,
              sampleRate: 44100,
              channels: 2,
              bitDepth: 16,
              format: fileExtension.substring(1).toUpperCase(),
            });
          });
          return;
        }

        const audioStream = metadata.streams.find(
          (stream) => stream.codec_type === 'audio',
        );
        const duration = metadata.format.duration || 0;
        const sampleRate = audioStream?.sample_rate || 44100;
        const channels = audioStream?.channels || 2;
        const bitDepth = audioStream?.bits_per_sample || 16;

        const format =
          metadata.format.format_name?.split(',')[0]?.toUpperCase() ||
          path.extname(filePath).substring(1).toUpperCase();

        resolve({
          duration,
          sampleRate,
          channels,
          bitDepth,
          format,
        });
      });
    });
  }

  async validateAudioFile(filePath: string): Promise<boolean> {
    if (!fs.existsSync(filePath)) {
      return false;
    }

    const fileExtension = path.extname(filePath).toLowerCase();
    return this.SUPPORTED_FORMATS.includes(fileExtension);
  }
}
