import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AdaptersPersistenceModule } from 'src/adapters/persistence/persistence.module';
import { COSINE_PROVIDER } from 'src/application/ports/infrastructure/ICosineProvider';
import { CosineAdapter } from './cosine.adapter';

@Module({
  imports: [ConfigModule, AdaptersPersistenceModule],
  providers: [{ provide: COSINE_PROVIDER, useClass: CosineAdapter }],
  exports: [COSINE_PROVIDER],
})
export class CosineInfrastructureModule {}
