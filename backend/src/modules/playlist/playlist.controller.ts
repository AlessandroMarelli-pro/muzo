import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { TrackSimilarity } from '../recommendation/interfaces/recommendation.interface';
import { RecommendationService } from '../recommendation/services/recommendation.service';
import {
  AddTrackToPlaylistDto,
  CreatePlaylistDto,
  ReorderTracksDto,
  UpdatePlaylistDto,
} from './dto/playlist.dto';
import { PlaylistService } from './playlist.service';

@Controller('playlists')
export class PlaylistController {
  constructor(
    private readonly playlistService: PlaylistService,
    private readonly recommendationService: RecommendationService,
  ) { }

  @Post()
  async createPlaylist(@Body() createPlaylistDto: CreatePlaylistDto) {
    return this.playlistService.createPlaylist(createPlaylistDto);
  }

  @Get()
  async findAllPlaylists(@Query('userId') userId?: string) {
    return this.playlistService.findAllPlaylists();
  }

  @Get(':id')
  async findPlaylistById(
    @Param('id') id: string,
    @Query('userId') userId?: string,
  ) {
    return this.playlistService.findPlaylistById(id);
  }

  @Put(':id')
  async updatePlaylist(
    @Param('id') id: string,
    @Body() updatePlaylistDto: UpdatePlaylistDto,
    @Query('userId') userId?: string,
  ) {
    return this.playlistService.updatePlaylist(id, updatePlaylistDto);
  }

  @Delete(':id')
  async deletePlaylist(
    @Param('id') id: string,
    @Query('userId') userId?: string,
  ) {
    return this.playlistService.deletePlaylist(id);
  }

  @Get(':id/tracks')
  async getPlaylistTracks(
    @Param('id') playlistId: string,
    @Query('userId') userId?: string,
  ) {
    return this.playlistService.getPlaylistTracks(playlistId);
  }

  @Get(':id/stats')
  async getPlaylistStats(
    @Param('id') playlistId: string,
    @Query('userId') userId?: string,
  ) {
    return this.playlistService.getPlaylistStats(playlistId);
  }

  @Post(':id/tracks')
  async addTrackToPlaylist(
    @Param('id') playlistId: string,
    @Body() addTrackDto: AddTrackToPlaylistDto,
    @Query('userId') userId?: string,
  ) {
    return this.playlistService.addTrackToPlaylist(playlistId, addTrackDto);
  }

  @Delete(':id/tracks/:trackId')
  async removeTrackFromPlaylist(
    @Param('id') playlistId: string,
    @Param('trackId') trackId: string,
    @Query('userId') userId?: string,
  ) {
    return this.playlistService.removeTrackFromPlaylist(playlistId, trackId);
  }

  @Put(':id/tracks/reorder')
  async reorderTracks(
    @Param('id') playlistId: string,
    @Body() reorderDto: ReorderTracksDto,
    @Query('userId') userId?: string,
  ) {
    return this.playlistService.reorderTracks(playlistId, reorderDto);
  }

  @Get(':id/recommendations')
  async getPlaylistRecommendations(
    @Param('id') playlistId: string,
    @Query('limit') limit?: number,
    @Query('excludeTrackIds') excludeTrackIds?: string,
  ): Promise<TrackSimilarity[]> {
    const excludeIds = excludeTrackIds ? excludeTrackIds.split(',') : [];
    return this.recommendationService.getPlaylistRecommendations({
      playlistId,
      limit: limit ? parseInt(limit.toString()) : 20,
      excludeTrackIds: excludeIds,
    });
  }

}
