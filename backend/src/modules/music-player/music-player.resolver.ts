import { Args, Float, Mutation, Query, Resolver } from '@nestjs/graphql';
import { MusicTrackService } from '../music-track/music-track.service';
import { MusicPlayerWebSocketGateway } from '../websocket/music-player-websocket.gateway';
import { AudioAnalysisService } from './audio-analysis.service';
import { MusicPlayerService, SeekRequest } from './music-player.service';
import {
  AudioAnalysisResult,
  AudioInfo,
  BeatData,
  EnergyData,
  PlaybackSession,
  PlaybackState,
  RealTimeAnalysis,
  WaveformData,
} from './music-player.types';
import { WaveformService } from './waveform.service';

@Resolver()
export class MusicPlayerResolver {
  constructor(
    private readonly musicPlayerService: MusicPlayerService,
    private readonly waveformService: WaveformService,
    private readonly audioAnalysisService: AudioAnalysisService,
    private readonly musicTrackService: MusicTrackService,
    private readonly musicPlayerWebSocketGateway: MusicPlayerWebSocketGateway,
  ) {}

  @Query(() => PlaybackState, { nullable: true })
  async getPlaybackState(
    @Args('trackId') trackId: string,
  ): Promise<PlaybackState | null> {
    return this.musicPlayerService.getPlaybackState(trackId);
  }

  @Query(() => [PlaybackSession])
  async getActiveSessions(): Promise<PlaybackSession[]> {
    return this.musicPlayerService.getAllActiveSessions();
  }

  @Query(() => [Float])
  async getWaveformData(@Args('trackId') trackId: string): Promise<number[]> {
    return this.musicPlayerService.getWaveformData(trackId);
  }

  @Query(() => WaveformData)
  async getDetailedWaveformData(
    @Args('trackId') trackId: string,
  ): Promise<WaveformData> {
    const track = await this.musicTrackService.findOne(trackId);
    return this.waveformService.getDetailedWaveformData(track.filePath);
  }

  @Query(() => AudioAnalysisResult)
  async getAudioAnalysis(
    @Args('trackId') trackId: string,
  ): Promise<AudioAnalysisResult> {
    return this.musicPlayerService.getAudioAnalysis(trackId);
  }

  @Query(() => RealTimeAnalysis)
  async getRealTimeAnalysis(
    @Args('trackId') trackId: string,
    @Args('currentTime') currentTime: number,
  ): Promise<RealTimeAnalysis> {
    return this.audioAnalysisService.getRealTimeAnalysis(trackId, currentTime);
  }

  @Query(() => String)
  async getAudioStreamUrl(@Args('trackId') trackId: string): Promise<string> {
    return this.musicPlayerService.getAudioStreamUrl(trackId);
  }

  @Query(() => AudioInfo)
  async getAudioInfo(@Args('trackId') trackId: string): Promise<AudioInfo> {
    const track = await this.musicTrackService.findOne(trackId);
    const fileExtension = track.filePath.split('.').pop()?.toLowerCase();
    const contentType = this.getContentType(fileExtension || '');

    return {
      trackId: track.id,
      fileName: track.fileName,
      fileSize: track.fileSize,
      duration: track.duration,
      format: track.format,
      bitrate: track.bitrate,
      sampleRate: track.sampleRate,
      contentType,
    };
  }

  @Query(() => [BeatData])
  async getBeatData(@Args('trackId') trackId: string): Promise<BeatData[]> {
    return this.audioAnalysisService.getBeatData(trackId);
  }

  @Query(() => [EnergyData])
  async getEnergyData(@Args('trackId') trackId: string): Promise<EnergyData[]> {
    return this.audioAnalysisService.getEnergyData(trackId);
  }

  @Mutation(() => PlaybackState)
  async playTrack(
    @Args('trackId') trackId: string,
    @Args('startTime', { type: () => Float, defaultValue: 0 })
    startTime: number,
  ): Promise<PlaybackState> {
    const result = await this.musicPlayerService.playTrack(trackId, startTime);

    // Broadcast playback state change via WebSocket
    this.musicPlayerWebSocketGateway.broadcastPlaybackStateUpdate(result);

    return result;
  }

  @Mutation(() => PlaybackState)
  async pauseTrack(@Args('trackId') trackId: string): Promise<PlaybackState> {
    const result = await this.musicPlayerService.pauseTrack(trackId);

    // Broadcast playback state change via WebSocket
    this.musicPlayerWebSocketGateway.broadcastPlaybackStateUpdate(result);

    return result;
  }

  @Mutation(() => PlaybackState)
  async resumeTrack(@Args('trackId') trackId: string): Promise<PlaybackState> {
    const result = await this.musicPlayerService.resumeTrack(trackId);

    // Broadcast playback state change via WebSocket
    this.musicPlayerWebSocketGateway.broadcastPlaybackStateUpdate(result);

    return result;
  }

  @Mutation(() => PlaybackState)
  async seekTrack(
    @Args('trackId') trackId: string,
    @Args('timeInSeconds') timeInSeconds: number,
  ): Promise<PlaybackState> {
    const seekRequest: SeekRequest = { trackId, timeInSeconds };
    const result = await this.musicPlayerService.seekTrack(seekRequest);

    // Broadcast playback state change via WebSocket
    this.musicPlayerWebSocketGateway.broadcastPlaybackStateUpdate(result);

    return result;
  }

  @Mutation(() => Boolean)
  async stopTrack(@Args('trackId') trackId: string): Promise<boolean> {
    await this.musicPlayerService.stopTrack(trackId);

    // Broadcast playback stopped event via WebSocket
    this.musicPlayerWebSocketGateway.broadcastPlaybackStopped(trackId);

    return true;
  }

  @Mutation(() => PlaybackState)
  async setVolume(
    @Args('trackId') trackId: string,
    @Args('volume') volume: number,
  ): Promise<PlaybackState> {
    const result = await this.musicPlayerService.setVolume(trackId, volume);

    // Broadcast playback state change via WebSocket
    this.musicPlayerWebSocketGateway.broadcastPlaybackStateUpdate(result);

    return result;
  }

  @Mutation(() => PlaybackState)
  async setPlaybackRate(
    @Args('trackId') trackId: string,
    @Args('rate') rate: number,
  ): Promise<PlaybackState> {
    const result = await this.musicPlayerService.setPlaybackRate(trackId, rate);

    // Broadcast playback state change via WebSocket
    this.musicPlayerWebSocketGateway.broadcastPlaybackStateUpdate(result);

    return result;
  }

  // Note: GraphQL subscriptions replaced with WebSocket implementation
  // Real-time updates are now handled via MusicPlayerWebSocketGateway

  private getContentType(fileExtension: string): string {
    const contentTypes: Record<string, string> = {
      mp3: 'audio/mpeg',
      wav: 'audio/wav',
      flac: 'audio/flac',
      m4a: 'audio/mp4',
      aac: 'audio/aac',
      ogg: 'audio/ogg',
      wma: 'audio/x-ms-wma',
      aiff: 'audio/aiff',
      au: 'audio/basic',
      opus: 'audio/opus',
    };

    return contentTypes[fileExtension] || 'audio/mpeg';
  }
}
