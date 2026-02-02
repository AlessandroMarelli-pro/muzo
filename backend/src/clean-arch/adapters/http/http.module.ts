import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UseCasesModule } from 'src/clean-arch/application/use-cases/use-cases.module';
import { ImageController } from './controllers/image.controller';

@Module({
  imports: [ConfigModule, UseCasesModule],
  controllers: [ImageController],
})
export class HttpModule {}
