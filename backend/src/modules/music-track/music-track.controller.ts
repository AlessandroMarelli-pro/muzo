import { Body, Controller, Get, Post } from '@nestjs/common';
import { MusicTrack } from '../../models/music-track.model';

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

  @Post('batch-delete')
  async batchDelete(@Body() body: { ids: string[] }) {
    return this.musicTrackService.batchDelete(body.ids);
  }
}
