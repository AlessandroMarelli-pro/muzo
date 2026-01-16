import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class PlaylistFilterDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  genres?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  subgenres?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  atmospheres?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  libraryId?: string[];

  @IsOptional()
  @ValidateNested()
  @Type(() => TempoRangeDto)
  tempo?: { min?: number; max?: number };
}

export class TempoRangeDto {
  @IsOptional()
  @IsNumber()
  min?: number;

  @IsOptional()
  @IsNumber()
  max?: number;
}

export class CreatePlaylistDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => PlaylistFilterDto)
  filters?: PlaylistFilterDto;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxTracks?: number;
}

export class UpdatePlaylistDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}

export class AddTrackToPlaylistDto {
  @IsUUID()
  trackId: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  position?: number;
}

export class TrackOrderDto {
  @IsUUID()
  trackId: string;

  @IsInt()
  @Min(1)
  position: number;
}

export class ReorderTracksDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TrackOrderDto)
  trackOrders: TrackOrderDto[];
}

export class PlaylistRecommendationDto {
  @IsUUID()
  playlistId: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  excludeTrackIds?: string[];
}

export class UpdatePlaylistSortingDto {
  @IsString()
  sortingKey: string;

  @IsString()
  sortingDirection: string;
}
