import { Module } from '@nestjs/common';
import { SharedModule } from '../../shared/shared.module';
import { RecommendationModule } from '../recommendation/recommendation.module';
import { AdminMethodsController } from './admin-methods.controller';
import { AdminMethodsService } from './admin-methods.service';

@Module({
  imports: [SharedModule, RecommendationModule],
  controllers: [AdminMethodsController],
  providers: [AdminMethodsService],
  exports: [AdminMethodsService],
})
export class AdminMethodsModule { }
