import { PlaybackSession, PlaybackType } from '@prisma/client';

export { PlaybackSession, PlaybackType };

export interface CreatePlaybackSessionDto {
  trackId: string;
  userId?: string;
  sessionType?: PlaybackType;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  volume?: number;
  quality?: string;
}

export interface UpdatePlaybackSessionDto {
  endTime?: Date;
  duration?: number;
  volume?: number;
  quality?: string;
}

export interface PlaybackSessionWithRelations extends PlaybackSession {
  track: {
    id: string;
    fileName: string;
    duration: number;
    format: string;
  };
}

export interface PlaybackSessionQueryOptions {
  trackId?: string;
  userId?: string;
  sessionType?: PlaybackType;
  startTimeRange?: {
    from: Date;
    to: Date;
  };
  limit?: number;
  offset?: number;
  orderBy?: 'startTime' | 'duration' | 'createdAt';
  orderDirection?: 'asc' | 'desc';
}

export interface PlaybackStats {
  totalSessions: number;
  totalDuration: number;
  averageDuration: number;
  uniqueTracks: number;
  uniqueUsers: number;
  sessionTypeDistribution: Record<PlaybackType, number>;
  hourlyDistribution: Record<string, number>;
  dailyDistribution: Record<string, number>;
}
