import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SharedModule } from '../../shared/shared.module';
import { ImageController } from './image.controller';

import { ImageService } from './image.service';

@Module({
  imports: [ConfigModule, SharedModule],
  controllers: [ImageController],
  providers: [ImageService],
  exports: [ImageService],
})
export class ImageModule {}
