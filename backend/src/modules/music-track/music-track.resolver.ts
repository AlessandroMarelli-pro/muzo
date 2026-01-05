import {
  Args,
  ID,
  Mutation,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { AnalysisStatus } from '@prisma/client';
import { MusicTrackWithRelations } from '../../models/index';
import {
  CreateMusicTrackDto,
  MusicTrackByCategories,
  MusicTrackQueryOptions,
  UpdateMusicTrackDto,
} from '../../models/music-track.model';
import { MusicTrackService } from './music-track.service';

import { MusicTrack as MusicTrackModel } from '@prisma/client';

import { TrackRecommendation } from '../playlist/playlist.model';
import {
  AddTrackInput,
  AIAnalysisResult,
  IntelligentEditorSession,
  MusicTrack,
  MusicTrackByCategoriesGraphQL,
  MusicTrackListPaginated,
  SimpleMusicTrack,
  TrackQueryOptions,
  TrackQueryOptionsByCategories,
  UpdateTrackInput,
} from './music-track.model';

export function mapToSimpleMusicTrack(
  track: MusicTrackWithRelations,
): SimpleMusicTrack {
  return {
    id: track.id,
    artist: track.originalArtist || track.aiArtist || track.userArtist,
    title: track.originalTitle || track.aiTitle || track.userTitle,
    duration: track.duration,
    genre: track.originalGenre || track.aiGenre || track.userGenre,
    subgenre: track.aiSubgenre,
    description: track.aiDescription,
    tags: track.aiTags ? (JSON.parse(track.aiTags) as string[]) : null,
    date: track.originalDate || track.createdAt,
    listeningCount: track.listeningCount,
    lastPlayedAt: track.lastPlayedAt,
    isFavorite: track.isFavorite,
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
      userTags: track.userTags ? JSON.parse(track.userTags) : null,
      albumArtPath: '',
    };
  }

  // Helper function to convert array of Prisma MusicTracks to GraphQL MusicTracks
  private mapToGraphQLTracks(tracks: MusicTrackModel[]): MusicTrack[] {
    return tracks.map((track) => this.mapToGraphQLTrack(track));
  }

  private mapToGraphQLTracksList(
    tracks: MusicTrackWithRelations[],
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
  ): Promise<SimpleMusicTrack> {
    const track = !id
      ? await this.musicTrackService.getRandomTrack()
      : await this.musicTrackService.findOne(id);
    console.log(track);
    return mapToSimpleMusicTrack(track as MusicTrackWithRelations);
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

  @Query(() => MusicTrack, { nullable: true })
  async track(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<MusicTrack | null> {
    try {
      const track = await this.musicTrackService.findOne(id);
      return this.mapToGraphQLTrack(track);
    } catch (error) {
      return null;
    }
  }

  @Query(() => [MusicTrack])
  async searchTracks(
    @Args('query') query: string,
    @Args('libraryId', { type: () => ID, nullable: true }) libraryId?: string,
  ): Promise<MusicTrack[]> {
    // Simple search implementation - in a real app, you'd use a proper search engine
    const options: MusicTrackQueryOptions = {
      libraryId,
      limit: 50,
    };

    const tracks = await this.musicTrackService.findAll(options);
    const searchQuery = query.toLowerCase();
    const filteredTracks = tracks.filter(
      (track) =>
        track.originalTitle?.toLowerCase().includes(searchQuery) ||
        track.originalArtist?.toLowerCase().includes(searchQuery) ||
        track.originalAlbum?.toLowerCase().includes(searchQuery) ||
        track.fileName.toLowerCase().includes(searchQuery),
    );
    return this.mapToGraphQLTracks(filteredTracks);
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

  @Query(() => [MusicTrack])
  async mostPlayed(
    @Args('limit', { defaultValue: 20 }) limit: number,
  ): Promise<MusicTrack[]> {
    const options: MusicTrackQueryOptions = {
      limit,
      orderBy: 'listeningCount',
      orderDirection: 'desc',
    };

    const tracks = await this.musicTrackService.findAll(options);
    return this.mapToGraphQLTracks(tracks);
  }

  @Mutation(() => MusicTrack)
  async addTrack(@Args('input') input: AddTrackInput): Promise<MusicTrack> {
    // This would typically involve file scanning and metadata extraction
    // For now, we'll create a basic track entry
    const createDto: CreateMusicTrackDto = {
      filePath: input.filePath,
      fileName: input.filePath.split('/').pop() || 'unknown',
      fileSize: 0, // Would be extracted from file
      duration: 0, // Would be extracted from file
      format: input.filePath.split('.').pop()?.toUpperCase() || 'UNKNOWN',
      libraryId: input.libraryId,
    };

    const track = await this.musicTrackService.create(createDto);
    return this.mapToGraphQLTrack(track);
  }

  @Mutation(() => MusicTrack)
  async updateTrack(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateTrackInput,
  ): Promise<MusicTrack> {
    const updateDto: UpdateMusicTrackDto = {
      userTitle: input.userTitle,
      userArtist: input.userArtist,
      userAlbum: input.userAlbum,
      userGenre: input.userGenre,
      userTags: input.userTags,
    };

    const track = await this.musicTrackService.update(id, updateDto);
    return this.mapToGraphQLTrack(track);
  }

  @Mutation(() => Boolean)
  async deleteTrack(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<boolean> {
    await this.musicTrackService.remove(id);
    return true;
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
