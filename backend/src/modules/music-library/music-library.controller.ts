import { Controller, Get, Param } from '@nestjs/common';

import { MusicTrackService } from '../music-track/music-track.service';
import { MusicLibraryService } from './music-library.service';

@Controller('music-libraries')
export class MusicLibraryController {
  constructor(
    private readonly musicLibraryService: MusicLibraryService,
    private readonly musicTrackService: MusicTrackService,
  ) {}

  @Get('delete-library/:libraryId')
  async deleteLibrary(@Param('libraryId') libraryId: string): Promise<void> {
    await this.musicTrackService.deleteTracksFromLibrary(libraryId);
    await this.musicLibraryService.remove(libraryId);
  }
}
