import { BadRequestException, Injectable } from '@nestjs/common';
import ffmpeg from 'fluent-ffmpeg';
import * as fs from 'fs';
import * as path from 'path';
import { Writable } from 'stream';

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
      const sampleRate = 44100;
      const channels = 1; // Mono
      const bytesPerSample = 2; // 16-bit = 2 bytes
      const chunks: Buffer[] = [];

      // Create a writable stream to capture PCM data directly from ffmpeg
      const outputStream = new Writable({
        write(chunk: Buffer, encoding, callback) {
          chunks.push(chunk);
          callback();
        },
      });

      // Process the accumulated data when stream finishes
      outputStream.on('finish', () => {
        try {
          // Combine all chunks into a single buffer
          const pcmBuffer = Buffer.concat(chunks);
          const totalSamples = pcmBuffer.length / bytesPerSample;

          if (totalSamples === 0) {
            throw new Error('No audio data extracted');
          }

          // Convert PCM buffer to normalized float array
          const audioData = new Float32Array(totalSamples);
          for (let i = 0; i < totalSamples; i++) {
            // Read 16-bit signed integer (little-endian)
            const int16 = pcmBuffer.readInt16LE(i * bytesPerSample);
            // Normalize to [-1, 1] range
            audioData[i] = int16 / 32768.0;
          }

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
          reject(error);
        }
      });

      // Extract raw PCM data directly from any audio format (FLAC, OPUS, MP3, etc.)
      // Pipe output directly to memory - no temporary files needed
      ffmpeg(filePath)
        .audioChannels(channels) // Convert to mono for simpler analysis
        .audioFrequency(sampleRate) // Standard sample rate
        .outputOptions(['-f', 's16le']) // Raw PCM: signed 16-bit little-endian (no WAV header)
        .on('error', (error) => {
          reject(error);
        })
        .pipe(outputStream, { end: true }); // end: true closes the stream when ffmpeg finishes
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
