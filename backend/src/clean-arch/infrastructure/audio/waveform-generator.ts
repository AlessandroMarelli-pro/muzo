import { BadRequestException, Injectable } from '@nestjs/common';
import ffmpeg from 'fluent-ffmpeg';
import * as fs from 'fs';
import * as path from 'path';
import { Writable } from 'stream';

import { IAudioWaveformGenerator } from 'src/clean-arch/application/ports/infrastructure/IAudioWaveformGenerator';

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
export class WaveformGenerator implements IAudioWaveformGenerator {
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
}
