import { Module } from '@nestjs/common';
import { FileScanningService } from '../../shared/services/file-scanning.service';
import { SharedModule } from '../../shared/shared.module';
import { MusicTrackModule } from '../music-track/music-track.module';
import { QueueModule } from '../queue/queue.module';
import { MusicLibraryController } from './music-library.controller';
import { MusicLibraryResolver } from './music-library.resolver';
import { MusicLibraryService } from './music-library.service';

@Module({
  imports: [SharedModule, MusicTrackModule, QueueModule],
  providers: [MusicLibraryResolver, MusicLibraryService, FileScanningService],
  exports: [MusicLibraryService, FileScanningService],
  controllers: [MusicLibraryController],
})
export class MusicLibraryModule {}
