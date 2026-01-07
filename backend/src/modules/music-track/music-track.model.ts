import { Field, Float, ID, InputType, ObjectType } from '@nestjs/graphql';

// GraphQL Types
@ObjectType()
export class AudioFingerprint {
  @Field(() => ID)
  id: string;

  @Field(() => ID)
  trackId: string;

  @Field(() => [Float], { nullable: true })
  mfcc: number[];

  @Field(() => Float, { nullable: true })
  spectralCentroid: number;

  @Field(() => Float, { nullable: true })
  spectralRolloff: number;

  @Field(() => [Float], { nullable: true })
  spectralContrast: number[];

  @Field(() => [Float], { nullable: true })
  chroma: number[];

  @Field(() => Float, { nullable: true })
  zeroCrossingRate: number;

  @Field(() => Float, { nullable: true })
  tempo?: number;

  @Field({ nullable: true })
  key?: string;

  @Field(() => Float, { nullable: true })
  energy?: number;

  @Field(() => Float, { nullable: true })
  valence?: number;

  @Field(() => Float, { nullable: true })
  danceability?: number;

  @Field(() => Float, { nullable: true })
  acousticness?: number;

  @Field(() => Float, { nullable: true })
  instrumentalness?: number;

  @Field(() => Float, { nullable: true })
  speechiness?: number;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}

@ObjectType()
export class ImageSearch {
  @Field(() => ID)
  id: string;

  @Field()
  imagePath: string;

  @Field()
  imageUrl: string;

  @Field()
  source: string;
}

// GraphQL Object Types
@ObjectType()
export class MusicTrack {
  @Field(() => ID)
  id: string;

  @Field()
  filePath: string;

  @Field()
  fileName: string;

  @Field()
  fileSize: number;

  @Field()
  duration: number;

  @Field()
  format: string;

  @Field({ nullable: true })
  bitrate?: number;

  @Field({ nullable: true })
  sampleRate?: number;

  @Field({ nullable: true })
  originalTitle?: string;

  @Field({ nullable: true })
  originalArtist?: string;

  @Field({ nullable: true })
  originalAlbum?: string;

  @Field({ nullable: true })
  originalYear?: number;

  @Field({ nullable: true })
  aiTitle?: string;

  @Field({ nullable: true })
  aiArtist?: string;

  @Field({ nullable: true })
  aiAlbum?: string;

  @Field({ nullable: true })
  aiConfidence?: number;

  @Field({ nullable: true })
  aiSubgenreConfidence?: number;

  @Field({ nullable: true })
  aiDescription?: string;

  @Field(() => [String], { nullable: true })
  aiTags?: string[];

  @Field({ nullable: true })
  userTitle?: string;

  @Field({ nullable: true })
  userArtist?: string;

  @Field({ nullable: true })
  userAlbum?: string;

  @Field(() => [String], { nullable: true })
  userTags?: string[];

  @Field()
  listeningCount: number;

  @Field({ nullable: true })
  lastPlayedAt?: Date;

  @Field()
  analysisStatus: string;

  @Field({ nullable: true })
  analysisStartedAt?: Date;

  @Field({ nullable: true })
  analysisCompletedAt?: Date;

  @Field({ nullable: true })
  analysisError?: string;

  @Field({ nullable: true })
  albumArtPath: string;

  @Field(() => ID)
  libraryId: string;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;

  @Field(() => AudioFingerprint, { nullable: true })
  audioFingerprint?: AudioFingerprint;

  @Field(() => [ImageSearch], { nullable: true })
  imageSearches?: ImageSearch[];

  @Field()
  isFavorite: boolean;
}

// GraphQL Input Types
@InputType()
export class AddTrackInput {
  @Field(() => ID)
  libraryId: string;

  @Field()
  filePath: string;
}

@InputType()
export class UpdateTrackInput {
  @Field({ nullable: true })
  userTitle?: string;

  @Field({ nullable: true })
  userArtist?: string;

  @Field({ nullable: true })
  userAlbum?: string;

  @Field(() => [String], { nullable: true })
  userTags?: string[];

  @Field(() => [String], { nullable: true })
  genreIds?: string[];

  @Field(() => [String], { nullable: true })
  subgenreIds?: string[];
}

@InputType()
export class TrackQueryOptions {
  @Field(() => ID, { nullable: true })
  libraryId?: string;

  @Field({ nullable: true })
  analysisStatus?: string;

  @Field({ nullable: true })
  format?: string;

  @Field({ nullable: true })
  limit?: number;

  @Field({ nullable: true })
  offset?: number;

  @Field({ nullable: true })
  orderBy?: string;

  @Field({ nullable: true })
  orderDirection?: string;

  @Field({ nullable: true })
  isFavorite?: boolean;
}

@InputType()
export class TrackQueryOptionsByCategories extends TrackQueryOptions {
  @Field({ nullable: true })
  category?: 'genre' | 'subgenre';

  @Field({ nullable: true })
  genre?: string;
}

@ObjectType()
export class AIAnalysisResult {
  @Field(() => ID)
  id: string;

  @Field(() => ID)
  trackId: string;

  @Field(() => ID)
  fingerprintId: string;

  @Field()
  modelVersion: string;

  @Field()
  genreClassification: string;

  @Field({ nullable: true })
  artistSuggestion?: string;

  @Field({ nullable: true })
  albumSuggestion?: string;

  @Field()
  processingTime: number;

  @Field({ nullable: true })
  errorMessage?: string;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}

@ObjectType()
export class IntelligentEditorSession {
  @Field(() => ID)
  id: string;

  @Field(() => ID)
  trackId: string;

  @Field(() => ID, { nullable: true })
  userId?: string;

  @Field()
  sessionStatus: string;

  @Field()
  suggestions: string;

  @Field()
  userActions: string;

  @Field({ nullable: true })
  confidenceThreshold?: number;

  @Field({ nullable: true })
  sessionDuration?: number;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}

@ObjectType()
export class MusicTrackByCategoriesGraphQL {
  @Field(() => ID)
  category: 'genre' | 'subgenre';
  @Field()
  name: string;
  @Field(() => [SimpleMusicTrack])
  tracks: SimpleMusicTrack[];
  @Field()
  trackCount: number;
}

@ObjectType()
export class SimpleMusicTrack {
  @Field(() => ID)
  id: string;

  @Field({ nullable: true })
  artist: string;

  @Field({ nullable: true })
  title: string;

  @Field(() => Float)
  duration: number;

  @Field(() => [String], { nullable: true })
  genres?: string[];

  @Field(() => [String], { nullable: true })
  subgenres?: string[];

  @Field({ nullable: true })
  date: Date;

  @Field({ nullable: true })
  description?: string;

  @Field(() => String, { nullable: true })
  vocalsDescriptions?: string;

  @Field(() => [String], { nullable: true })
  atmosphereKeywords?: string[];

  @Field(() => String, { nullable: true })
  contextBackgrounds?: string;

  @Field(() => String, { nullable: true })
  contextImpacts?: string;

  @Field(() => [String], { nullable: true })
  tags?: string[];

  @Field(() => Float, { nullable: true })
  listeningCount?: number;

  @Field({ nullable: true })
  lastPlayedAt?: Date;

  @Field({ nullable: true })
  isFavorite: boolean;

  @Field({ nullable: true })
  isLiked: boolean;

  @Field({ nullable: true })
  isBanger: boolean;

  @Field({ nullable: true })
  createdAt: Date;

  @Field({ nullable: true })
  updatedAt: Date;

  @Field(() => Float, { nullable: true })
  tempo?: number;

  @Field({ nullable: true })
  key?: string;

  @Field(() => String, { nullable: true })
  valenceMood?: string;

  @Field(() => String, { nullable: true })
  arousalMood?: string;

  @Field(() => String, { nullable: true })
  danceabilityFeeling?: string;

  @Field(() => Float, { nullable: true })
  acousticness?: number;

  @Field(() => Float, { nullable: true })
  instrumentalness?: number;

  @Field(() => Float, { nullable: true })
  speechiness?: number;

  @Field({ nullable: true })
  imagePath?: string;

  @Field(() => Date, { nullable: true })
  lastScannedAt?: Date;
}

@ObjectType()
export class MusicTrackListPaginated {
  @Field(() => [SimpleMusicTrack])
  tracks: SimpleMusicTrack[];
  @Field()
  total: number;
  @Field()
  page: number;
  @Field()
  limit: number;
}
