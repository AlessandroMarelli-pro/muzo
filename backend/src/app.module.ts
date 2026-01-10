import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { join } from 'path';
import { ConfigModuleSetup } from './config';
import { AdminMethodsModule } from './modules/admin-methods/admin-methods.module';
import { AiIntegrationModule } from './modules/ai-integration/ai-integration.module';
import { FilterModule } from './modules/filter/filter.module';
import { HealthModule } from './modules/health/health.module';
import { ImageModule } from './modules/image/image.module';
import { MetricsModule } from './modules/metrics/metrics.module';
import { MusicLibraryModule } from './modules/music-library/music-library.module';
import { MusicPlayerModule } from './modules/music-player/music-player.module';
import { MusicTrackModule } from './modules/music-track/music-track.module';
import { PlaylistModule } from './modules/playlist/playlist.module';
import { QueueModule } from './modules/queue/queue.module';
import { RecommendationModule } from './modules/recommendation/recommendation.module';
import { ThirdPartySyncModule } from './modules/third-party-sync/third-party-sync.module';
import { UserPreferencesModule } from './modules/user-preferences/user-preferences.module';
import { WebSocketModule } from './modules/websocket/websocket.module';
import { SharedModule } from './shared/shared.module';

@Module({
  imports: [
    // Configuration module
    ConfigModuleSetup,

    // GraphQL module
    GraphQLModule.forRootAsync<ApolloDriverConfig>({
      driver: ApolloDriver,
      useFactory: (configService: ConfigService) => ({
        autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
        sortSchema: true,
        playground: configService.get<boolean>('app.graphqlPlayground'),
        introspection: configService.get<boolean>('app.graphqlIntrospection'),
        subscriptions: {
          'graphql-ws': true,
          'subscriptions-transport-ws': true,
        },
      }),
      inject: [ConfigService],
    }),

    // Shared module for common services
    SharedModule,

    // Queue module for background processing
    QueueModule,

    // Feature modules
    HealthModule,
    ImageModule,
    MusicLibraryModule,
    MusicTrackModule,
    MusicPlayerModule,
    PlaylistModule,
    RecommendationModule,
    ThirdPartySyncModule,
    UserPreferencesModule,
    AiIntegrationModule,
    WebSocketModule,
    FilterModule,
    MetricsModule,
    AdminMethodsModule,
  ],
})
export class AppModule {}
