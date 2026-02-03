import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UseCasesModule } from 'src/clean-arch/application/use-cases/use-cases.module';
import { HttpAuthGuard } from './context/http-auth.guard';
import { AudioStreamingController } from './controllers/audio-streaming.controller';
import { ImageController } from './controllers/image.controller';

@Module({
  imports: [ConfigModule, UseCasesModule],
  controllers: [ImageController, AudioStreamingController],
  providers: [HttpAuthGuard],
})
export class HttpModule {}
