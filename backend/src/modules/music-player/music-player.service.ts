import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as fs from 'fs';
import { PrismaService } from '../../shared/services/prisma.service';
import { MusicTrackService } from '../music-track/music-track.service';
import { WaveformService } from './waveform.service';

export interface PlaybackState {
  trackId: string;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  playbackRate: number;
  isFavorite: boolean;
}

export interface SeekRequest {
  trackId: string;
  timeInSeconds: number;
}

export interface PlaybackSession {
  id: string;
  trackId: string;
  startTime: Date;
  currentTime: number;
  duration: number;
  isActive: boolean;
}

@Injectable()
export class MusicPlayerService {
  constructor(
    private readonly musicTrackService: MusicTrackService,
    private readonly waveformService: WaveformService,
    private readonly prisma: PrismaService,
  ) {}

  async getAudioStreamUrl(trackId: string): Promise<string> {
    const track = await this.musicTrackService.findOne(trackId);

    if (!track) {
      throw new NotFoundException(`Track with ID ${trackId} not found`);
    }

    if (!fs.existsSync(track.filePath)) {
      throw new BadRequestException(
        `Audio file not found at path: ${track.filePath}`,
      );
    }

    // Return the file path for streaming
    // In production, you might want to serve this through a proper streaming endpoint
    return `/api/audio/stream/${trackId}`;
  }

  async getWaveformData(trackId: string): Promise<number[]> {
    const track = await this.musicTrackService.findOne(trackId);

    if (!track) {
      throw new NotFoundException(`Track with ID ${trackId} not found`);
    }

    return this.waveformService.generateWaveform(track.filePath);
  }
}
