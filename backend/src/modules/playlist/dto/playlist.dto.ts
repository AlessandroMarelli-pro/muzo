import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

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
