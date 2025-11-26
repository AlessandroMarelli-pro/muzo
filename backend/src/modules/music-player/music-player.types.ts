import { Field, Float, ID, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class PlaybackState {
  @Field(() => ID)
  trackId: string;

  @Field(() => Boolean)
  isPlaying: boolean;

  @Field(() => Float)
  currentTime: number;

  @Field(() => Float)
  duration: number;

  @Field(() => Float)
  volume: number;

  @Field(() => Float)
  playbackRate: number;

  @Field(() => Boolean)
  isFavorite: boolean;
}

@ObjectType()
export class PlaybackSession {
  @Field(() => ID)
  id: string;

  @Field(() => ID)
  trackId: string;

  @Field(() => Date)
  startTime: Date;

  @Field(() => Float)
  currentTime: number;

  @Field(() => Float)
  duration: number;

  @Field(() => Boolean)
  isActive: boolean;
}

@ObjectType()
export class BeatData {
  @Field(() => Float)
  timestamp: number;

  @Field(() => Float)
  confidence: number;

  @Field(() => Float)
  strength: number;
}

@ObjectType()
export class EnergyData {
  @Field(() => Float)
  timestamp: number;

  @Field(() => Float)
  energy: number;

  @Field(() => Float)
  frequency: number;
}

@ObjectType()
export class AudioAnalysisResult {
  @Field(() => [BeatData])
  beats: BeatData[];

  @Field(() => [EnergyData])
  energy: EnergyData[];

  @Field(() => Float)
  tempo: number;

  @Field(() => String)
  key: string;

  @Field(() => String)
  mode: string;

  @Field(() => Float)
  danceability: number;

  @Field(() => Float)
  valence: number;

  @Field(() => Float)
  acousticness: number;

  @Field(() => Float)
  instrumentalness: number;

  @Field(() => Float)
  liveness: number;

  @Field(() => Float)
  speechiness: number;

  @Field(() => Float)
  duration: number;

  @Field(() => String)
  analysisVersion: string;
}

@ObjectType()
export class RealTimeAnalysis {
  @Field(() => BeatData)
  currentBeat: BeatData;

  @Field(() => Float)
  currentEnergy: number;

  @Field(() => Float)
  beatConfidence: number;

  @Field(() => Float)
  nextBeatEstimate: number;

  @Field(() => String)
  energyTrend: string;
}

@ObjectType()
export class WaveformData {
  @Field(() => [Float])
  peaks: number[];

  @Field(() => Float)
  duration: number;

  @Field(() => Int)
  sampleRate: number;

  @Field(() => Int)
  channels: number;

  @Field(() => Int)
  bitDepth: number;
}

@ObjectType()
export class AudioInfo {
  @Field(() => ID)
  trackId: string;

  @Field(() => String)
  fileName: string;

  @Field(() => Float)
  fileSize: number;

  @Field(() => Float)
  duration: number;

  @Field(() => String)
  format: string;

  @Field(() => Float, { nullable: true })
  bitrate?: number;

  @Field(() => Int, { nullable: true })
  sampleRate?: number;

  @Field(() => String)
  contentType: string;
}
