import {
  Args,
  ID,
  Mutation,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { AnalysisStatus } from '@prisma/client';
import {
  MusicTrackWithRelations,
  SimpleMusicTrackInterface,
} from '../../models/index';
import {
  MusicTrackByCategories,
  MusicTrackQueryOptions,
} from '../../models/music-track.model';
import { MusicTrackService } from './music-track.service';

import { MusicTrack as MusicTrackModel } from '@prisma/client';

import { TrackRecommendation } from '../playlist/playlist.model';
import {
  AIAnalysisResult,
  IntelligentEditorSession,
  MusicTrack,
  MusicTrackByCategoriesGraphQL,
  MusicTrackListPaginated,
  RandomTrackWithStats,
  SimpleMusicTrack,
  TrackQueryOptions,
  TrackQueryOptionsByCategories,
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

  // Helper function to convert Prisma MusicTrack to GraphQL MusicTrack
  private mapToGraphQLTrack(track: MusicTrackModel): MusicTrack {
    return {
      ...track,
      aiTags: track.aiTags ? JSON.parse(track.aiTags) : null,
      aiDescription: track.aiDescription,
      userTags: [],
      albumArtPath: '',
    };
  }

  private mapToGraphQLTracksList(
    tracks: (MusicTrackWithRelations | SimpleMusicTrackInterface)[],
  ): SimpleMusicTrack[] {
    return tracks.map((track) => mapToSimpleMusicTrack(track));
  }

  private mapToGraphQLTracksByCategories(
    tracksByCategories: MusicTrackByCategories<MusicTrackModel>[],
  ): MusicTrackByCategoriesGraphQL[] {
    return tracksByCategories.map((trackByCategory) => ({
      ...trackByCategory,
      tracks: trackByCategory.tracks.map((track) =>
        mapToSimpleMusicTrack(track as MusicTrackWithRelations),
      ),
    }));
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

  @Query(() => MusicTrackListPaginated)
  async tracksList(
    @Args('options', { nullable: true }) options?: TrackQueryOptions,
  ): Promise<MusicTrackListPaginated> {
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
    const tracks = await this.musicTrackService.findAllPaginated(queryOptions);
    return {
      tracks: this.mapToGraphQLTracksList(tracks.tracks),
      total: tracks.total,
      page: tracks.page,
      limit: tracks.limit,
    };
  }

  @Query(() => SimpleMusicTrack)
  async randomTrack(
    @Args('id', { nullable: true }) id: string,
    @Args('filterLiked', { nullable: true }) filterLiked: boolean,
  ): Promise<SimpleMusicTrack> {
    const track = !id
      ? await this.musicTrackService.getRandomTrack(filterLiked)
      : await this.musicTrackService.findOne(id);
    return mapToSimpleMusicTrack(track as MusicTrackWithRelations);
  }

  @Query(() => RandomTrackWithStats)
  async randomTrackWithStats(): Promise<RandomTrackWithStats> {
    const result = await this.musicTrackService.getRandomTrackWithStats();
    return {
      track: result.track
        ? mapToSimpleMusicTrack(result.track as MusicTrackWithRelations)
        : null,
      likedCount: result.likedCount,
      bangerCount: result.bangerCount,
      dislikedCount: result.dislikedCount,
      remainingCount: result.remainingCount,
    };
  }

  @Query(() => [TrackRecommendation])
  async trackRecommendations(
    @Args('id') id: string,
    @Args('criteria', { nullable: true }) criteria?: string,
  ): Promise<TrackRecommendation[]> {
    return this.musicTrackService.getTrackRecommendations(id, criteria);
  }

  @Query(() => [MusicTrackByCategoriesGraphQL])
  async tracksByCategories(
    @Args('options', { nullable: true })
    options?: TrackQueryOptionsByCategories,
  ): Promise<MusicTrackByCategoriesGraphQL[]> {
    const queryOptions: MusicTrackQueryOptions & {
      category?: 'genre' | 'subgenre';
      genre?: string;
    } = {
      libraryId: options?.libraryId,
      genre: options?.genre,
      analysisStatus: options?.analysisStatus as AnalysisStatus,
      format: options?.format,
      limit: options?.limit,
      offset: options?.offset,
      orderBy: options?.orderBy as any,
      orderDirection: options?.orderDirection as any,
      category: options?.category as 'genre' | 'subgenre',
    };
    const tracks =
      await this.musicTrackService.findAllByCategories(queryOptions);
    return this.mapToGraphQLTracksByCategories(tracks);
  }

  @Query(() => [SimpleMusicTrack])
  async searchTracks(
    @Args('query') query: string,
    @Args('libraryId', { type: () => ID, nullable: true }) libraryId?: string,
  ): Promise<SimpleMusicTrack[]> {
    // Simple search implementation - in a real app, you'd use a proper search engine
    const options: MusicTrackQueryOptions = {
      libraryId,
      limit: 50,
    };
    //TODO: IMPLEMENT SEARCH

    const searchQuery = query.toLowerCase();
    const tracks = await this.musicTrackService.findAll(options);

    return this.mapToGraphQLTracksList(tracks);
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

  @Mutation(() => MusicTrack)
  async recordPlayback(
    @Args('trackId', { type: () => ID }) trackId: string,
    @Args('duration') duration: number,
  ): Promise<MusicTrack> {
    // Record playback and increment listening count
    const track = await this.musicTrackService.incrementListeningCount(trackId);
    return this.mapToGraphQLTrack(track);
  }

  @Mutation(() => MusicTrack)
  async toggleFavorite(@Args('trackId') trackId: string): Promise<MusicTrack> {
    const track = await this.musicTrackService.toggleFavorite(trackId);
    return this.mapToGraphQLTrack(track);
  }

  @Mutation(() => SimpleMusicTrack)
  async likeTrack(
    @Args('trackId', { type: () => ID }) trackId: string,
  ): Promise<SimpleMusicTrack> {
    const track = await this.musicTrackService.likeTrack(trackId);
    const trackWithRelations = await this.musicTrackService.findOne(trackId);
    return mapToSimpleMusicTrack(trackWithRelations as MusicTrackWithRelations);
  }

  @Mutation(() => SimpleMusicTrack)
  async bangerTrack(
    @Args('trackId', { type: () => ID }) trackId: string,
  ): Promise<SimpleMusicTrack> {
    const track = await this.musicTrackService.bangerTrack(trackId);
    const trackWithRelations = await this.musicTrackService.findOne(trackId);
    return mapToSimpleMusicTrack(trackWithRelations as MusicTrackWithRelations);
  }

  @Mutation(() => Boolean)
  async dislikeTrack(
    @Args('trackId', { type: () => ID }) trackId: string,
  ): Promise<boolean> {
    await this.musicTrackService.dislikeTrack(trackId);
    return true;
  }

  /*  @ResolveField(() => AudioFingerprint, { nullable: true })
  async audioFingerprint(track: MusicTrack): Promise<AudioFingerprint | null> {
    // This would typically fetch from the database
    // For now, return null as we haven't implemented audio fingerprinting yet
    return null;
  } */

  @ResolveField(() => AIAnalysisResult, { nullable: true })
  async analysisResult(track: MusicTrack): Promise<AIAnalysisResult | null> {
    // This would typically fetch from the database
    // For now, return null as we haven't implemented AI analysis yet
    return null;
  }

  @ResolveField(() => IntelligentEditorSession, { nullable: true })
  async editorSession(
    track: MusicTrack,
  ): Promise<IntelligentEditorSession | null> {
    // This would typically fetch from the database
    // For now, return null as we haven't implemented editor sessions yet
    return null;
  }
}
