import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { COSINE_PROVIDER } from 'src/application/ports/infrastructure/ICosineProvider';
import { CosineAdapter } from './cosine.adapter';

@Module({
  imports: [ConfigModule],
  providers: [{ provide: COSINE_PROVIDER, useClass: CosineAdapter }],
  exports: [COSINE_PROVIDER],
})
export class CosineInfrastructureModule {}
