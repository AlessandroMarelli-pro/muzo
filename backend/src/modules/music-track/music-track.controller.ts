import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { MusicTrack } from '../../models/music-track.model';

import { MusicTrackWithRelations } from '../../models/index';
import { PrismaService } from '../../shared/services/prisma.service';
import { MusicTrackService } from './music-track.service';

@Controller('music-tracks')
export class MusicTrackController {
  constructor(
    private readonly musicTrackService: MusicTrackService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('has-musicbrainz')
  async hasMusicbrainz(): Promise<MusicTrack[]> {
    return this.prisma.musicTrack.findMany({
      where: {
        hasMusicbrainz: true,
      },
    });
  }
  @Get(':id')
  async findOne(@Param('id') id: string): Promise<MusicTrackWithRelations> {
    try {
      const track = await this.musicTrackService.findOneWithAllRelations(id);
      return track;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new NotFoundException(`Music track with ID ${id} not found`);
    }
  }

  @Post('batch-delete')
  async batchDelete(@Body() body: { ids: string[] }) {
    return this.musicTrackService.batchDelete(body.ids);
  }
}
