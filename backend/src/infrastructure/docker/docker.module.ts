import { Global, Module } from '@nestjs/common';
import { DOCKER_SCALING_SERVICE } from 'src/application/ports/infrastructure/IDockerScalingService';
import { DockerEngineApiClient } from './docker-engine-api.client';
import { DockerScalingService } from './docker-scaling.service';

@Global()
@Module({
  providers: [
    DockerEngineApiClient,
    {
      provide: DOCKER_SCALING_SERVICE,
      useClass: DockerScalingService,
    },
  ],
  exports: [DOCKER_SCALING_SERVICE],
})
export class DockerInfrastructureModule {}
