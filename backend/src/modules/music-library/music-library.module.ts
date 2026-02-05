import { Module } from '@nestjs/common';
import { FileScanningService } from '../../shared/services/file-scanning.service';
import { SharedModule } from '../../shared/shared.module';
import { QueueModule } from '../queue/queue.module';
import { MusicLibraryResolver } from './music-library.resolver';
import { MusicLibraryService } from './music-library.service';

@Module({
  imports: [SharedModule, QueueModule],
  providers: [MusicLibraryResolver, MusicLibraryService, FileScanningService],
  exports: [MusicLibraryService, FileScanningService],
})
export class MusicLibraryModule {}
