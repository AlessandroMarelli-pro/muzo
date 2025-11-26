import { Type } from 'class-transformer';
import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { RecommendationWeights } from '../interfaces/recommendation.interface';

export class PlaylistRecommendationDto {
  @IsString()
  playlistId: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 20;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  excludeTrackIds?: string[] = [];
}

export class TrackRecommendationDto {
  @IsString()
  trackId: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 20;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  excludeTrackIds?: string[] = [];
}

export class RecommendationWeightsDto {
  @IsNumber()
  @Min(0)
  @Max(1)
  audioSimilarity: number;

  @IsNumber()
  @Min(0)
  @Max(1)
  genreSimilarity: number;

  @IsNumber()
  @Min(0)
  @Max(1)
  metadataSimilarity: number;

  @IsNumber()
  @Min(0)
  @Max(1)
  userBehavior: number;

  @IsNumber()
  @Min(0)
  @Max(1)
  audioFeatures: number;
}

export class CreateUserRecommendationPreferencesDto {
  @IsString()
  userId: string;

  @Type(() => RecommendationWeightsDto)
  weights: RecommendationWeights;

  @IsOptional()
  isDefault?: boolean = false;
}

export class UpdateUserRecommendationPreferencesDto {
  @IsOptional()
  @Type(() => RecommendationWeightsDto)
  weights?: RecommendationWeights;

  @IsOptional()
  isDefault?: boolean;
}
