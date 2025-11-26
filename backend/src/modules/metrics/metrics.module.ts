import { Module } from '@nestjs/common';
import { SharedModule } from '../../shared/shared.module';
import { MetricsResolver } from './metrics.resolver';
import { MetricsService } from './metrics.service';

@Module({
  imports: [SharedModule],
  providers: [MetricsService, MetricsResolver],
  exports: [MetricsService],
})
export class MetricsModule {}
