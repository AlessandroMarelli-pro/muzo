import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as fs from 'fs';
import { PrismaService } from '../../shared/services/prisma.service';
import { MusicTrackService } from '../music-track/music-track.service';
import { AudioAnalysisService } from './audio-analysis.service';
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
  private activeSessions = new Map<string, PlaybackSession>();
  private playbackStates = new Map<string, PlaybackState>();

  constructor(
    private readonly musicTrackService: MusicTrackService,
    private readonly waveformService: WaveformService,
    private readonly audioAnalysisService: AudioAnalysisService,
    private readonly prisma: PrismaService,
  ) {}

  async playTrack(
    trackId: string,
    startTime: number = 0,
  ): Promise<PlaybackState> {
    const track = await this.musicTrackService.findOne(trackId);

    if (!track) {
      throw new NotFoundException(`Track with ID ${trackId} not found`);
    }

    if (!fs.existsSync(track.filePath)) {
      throw new BadRequestException(
        `Audio file not found at path: ${track.filePath}`,
      );
    }

    // Create or update playback session
    const sessionId = `session_${trackId}_${Date.now()}`;
    const session: PlaybackSession = {
      id: sessionId,
      trackId,
      startTime: new Date(),
      currentTime: startTime,
      duration: track.duration,
      isActive: true,
    };

    this.activeSessions.set(sessionId, session);

    // Initialize playback state
    const playbackState: PlaybackState = {
      trackId,
      isPlaying: true,
      currentTime: startTime,
      duration: track.duration,
      volume: 1.0,
      playbackRate: 1.0,
      isFavorite: track.isFavorite,
    };

    this.playbackStates.set(trackId, playbackState);

    // Record playback in database
    await this.recordPlaybackSession(trackId, startTime);

    return playbackState;
  }

  async pauseTrack(trackId: string): Promise<PlaybackState> {
    const state = this.playbackStates.get(trackId);

    if (!state) {
      throw new NotFoundException(
        `No active playback session for track ${trackId}`,
      );
    }

    state.isPlaying = false;
    this.playbackStates.set(trackId, state);

    return state;
  }

  async resumeTrack(trackId: string): Promise<PlaybackState> {
    const state = this.playbackStates.get(trackId);

    if (!state) {
      throw new NotFoundException(
        `No active playback session for track ${trackId}`,
      );
    }

    state.isPlaying = true;
    this.playbackStates.set(trackId, state);

    return state;
  }

  async seekTrack(seekRequest: SeekRequest): Promise<PlaybackState> {
    const { trackId, timeInSeconds } = seekRequest;
    const state = this.playbackStates.get(trackId);

    if (!state) {
      throw new NotFoundException(
        `No active playback session for track ${trackId}`,
      );
    }

    if (timeInSeconds < 0 || timeInSeconds > state.duration) {
      throw new BadRequestException(
        `Seek time ${timeInSeconds}s is outside valid range (0-${state.duration}s)`,
      );
    }

    state.currentTime = timeInSeconds;
    this.playbackStates.set(trackId, state);

    // Update active session
    const session = Array.from(this.activeSessions.values()).find(
      (s) => s.trackId === trackId && s.isActive,
    );

    if (session) {
      session.currentTime = timeInSeconds;
    }

    return state;
  }

  async stopTrack(trackId: string): Promise<void> {
    const state = this.playbackStates.get(trackId);

    if (!state) {
      throw new NotFoundException(
        `No active playback session for track ${trackId}`,
      );
    }

    // Remove from active sessions
    this.activeSessions.forEach((session, sessionId) => {
      if (session.trackId === trackId) {
        session.isActive = false;
        this.activeSessions.delete(sessionId);
      }
    });

    this.playbackStates.delete(trackId);
  }

  async getPlaybackState(trackId: string): Promise<PlaybackState | null> {
    return this.playbackStates.get(trackId) || null;
  }

  async getAllActiveSessions(): Promise<PlaybackSession[]> {
    return Array.from(this.activeSessions.values()).filter(
      (session) => session.isActive,
    );
  }

  async setVolume(trackId: string, volume: number): Promise<PlaybackState> {
    const state = this.playbackStates.get(trackId);

    if (!state) {
      throw new NotFoundException(
        `No active playback session for track ${trackId}`,
      );
    }

    if (volume < 0 || volume > 1) {
      throw new BadRequestException('Volume must be between 0 and 1');
    }

    state.volume = volume;
    this.playbackStates.set(trackId, state);

    return state;
  }

  async setPlaybackRate(trackId: string, rate: number): Promise<PlaybackState> {
    const state = this.playbackStates.get(trackId);

    if (!state) {
      throw new NotFoundException(
        `No active playback session for track ${trackId}`,
      );
    }

    if (rate < 0.25 || rate > 4.0) {
      throw new BadRequestException(
        'Playback rate must be between 0.25 and 4.0',
      );
    }

    state.playbackRate = rate;
    this.playbackStates.set(trackId, state);

    return state;
  }

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

  async getAudioAnalysis(trackId: string): Promise<any> {
    return this.audioAnalysisService.analyzeAudio(trackId);
  }

  private async recordPlaybackSession(
    trackId: string,
    startTime: number,
  ): Promise<void> {
    try {
      await this.prisma.playbackSession.create({
        data: {
          trackId,
          sessionType: 'MANUAL',
          startTime: new Date(),
          duration: startTime,
        },
      });

      // Increment listening count
      await this.musicTrackService.incrementListeningCount(trackId);
    } catch (error) {
      console.error('Failed to record playback session:', error);
      // Don't throw error as this is not critical for playback functionality
    }
  }

  async cleanupInactiveSessions(): Promise<void> {
    const now = new Date();
    const inactiveThreshold = 30 * 60 * 1000; // 30 minutes

    this.activeSessions.forEach((session, sessionId) => {
      const timeSinceStart = now.getTime() - session.startTime.getTime();

      if (timeSinceStart > inactiveThreshold || !session.isActive) {
        this.activeSessions.delete(sessionId);
        this.playbackStates.delete(session.trackId);
      }
    });
  }
}
