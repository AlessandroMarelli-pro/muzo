import { Args, Query, Resolver } from '@nestjs/graphql';
import { AnalysisStatus } from '@prisma/client';
import {
  MusicTrackWithRelations,
  SimpleMusicTrackInterface,
} from '../../models/index';
import { MusicTrackQueryOptions } from '../../models/music-track.model';
import { MusicTrackService } from './music-track.service';

import {
  MusicTrack,
  SimpleMusicTrack,
  TrackQueryOptions,
} from './music-track.model';

export function mapToSimpleMusicTrack(
  track: MusicTrackWithRelations | SimpleMusicTrackInterface,
): SimpleMusicTrack {
  return {
    id: track.id,
    format: track.format,
    artist: track.originalArtist || track.aiArtist || track.userArtist,
    title: track.originalTitle || track.aiTitle || track.userTitle,
    duration: track.duration,
    genres: track.trackGenres?.map((tg) => tg.genre.name) || [],
    subgenres: track.trackSubgenres?.map((ts) => ts.subgenre.name) || [],
    description: track.aiDescription,
    vocalsDescriptions: track.vocalsDesc,
    atmosphereKeywords: track.atmosphereDesc
      ? (JSON.parse(track.atmosphereDesc) as string[])
      : null,
    contextBackgrounds: track.contextBackground,
    contextImpacts: track.contextImpact,
    tags: track.aiTags ? (JSON.parse(track.aiTags) as string[]) : null,
    date: track.originalDate || track.createdAt,
    listeningCount: track.listeningCount,
    lastPlayedAt: track.lastPlayedAt,
    isFavorite: track.isFavorite,
    isLiked: track.isLiked || false,
    isBanger: track.isBanger || false,
    createdAt: track.createdAt,
    updatedAt: track.updatedAt,
    tempo: Math.round((track.audioFingerprint?.tempo || 0) * 100) / 100,
    key: track.audioFingerprint?.key || '',
    valenceMood: track.audioFingerprint?.valenceMood || '',
    arousalMood: track.audioFingerprint?.arousalMood || '',
    danceabilityFeeling: track.audioFingerprint?.danceabilityFeeling || '',
    acousticness: track.audioFingerprint?.acousticness || 0,
    instrumentalness: track.audioFingerprint?.instrumentalness || 0,
    speechiness: track.audioFingerprint?.speechiness || 0,
    imagePath: track.imageSearches?.[0]?.imagePath || '',
    lastScannedAt: track.analysisCompletedAt || null,
    fileCreatedAt: track.fileCreatedAt || null,
    libraryId: track.libraryId || '',
  };
}

@Resolver(() => MusicTrack)
export class MusicTrackResolver {
  constructor(private readonly musicTrackService: MusicTrackService) {}

  private mapToGraphQLTracksList(
    tracks: (MusicTrackWithRelations | SimpleMusicTrackInterface)[],
  ): SimpleMusicTrack[] {
    return tracks.map((track) => mapToSimpleMusicTrack(track));
  }

  @Query(() => [SimpleMusicTrack])
  async tracks(
    @Args('options', { nullable: true }) options?: TrackQueryOptions,
  ): Promise<SimpleMusicTrack[]> {
    const queryOptions: MusicTrackQueryOptions = {
      isFavorite: options?.isFavorite,
      libraryId: options?.libraryId,
      analysisStatus: options?.analysisStatus as AnalysisStatus,
      format: options?.format,
      limit: options?.limit,
      offset: options?.offset,
      orderBy: options?.orderBy as any,
      orderDirection: options?.orderDirection as any,
    };
    const tracks = await this.musicTrackService.findAll(queryOptions);
    return this.mapToGraphQLTracksList(tracks as MusicTrackWithRelations[]);
  }

  @Query(() => [SimpleMusicTrack])
  async recentlyPlayed(
    @Args('limit', { defaultValue: 20 }) limit: number,
  ): Promise<SimpleMusicTrack[]> {
    const options: MusicTrackQueryOptions = {
      limit,
      orderBy: 'updatedAt', // Use updatedAt instead of lastPlayedAt
      orderDirection: 'desc',
    };

    const tracks = await this.musicTrackService.findAll(options);
    const filteredTracks = tracks.filter(
      (track) => track.lastPlayedAt !== null,
    );
    return this.mapToGraphQLTracksList(filteredTracks);
  }
}
