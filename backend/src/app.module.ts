import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { BullModule } from '@nestjs/bullmq';
import { MiddlewareConsumer, Module, RequestMethod } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GraphQLModule as NestjsGraphQLModule } from '@nestjs/graphql';
import { join } from 'path';
import { ActionContextMiddleware } from './adapters/common/middlewares/action-context.middleware';
import { GraphQLModule } from './adapters/graphql/graphql.module';
import { HttpModule } from './adapters/http/http.module';
import { JobSchedulersModule } from './adapters/job-schedulers/job-schedulers.module';
import { AdaptersPersistenceModule } from './adapters/persistence/persistence.module';
import { createPlaylistStatsLoader } from './adapters/persistence/queries/playlist/playlist-stats.loader';
import { createPlaylistContainsTrackLoader } from './adapters/persistence/repositories/playlist-track/playlist-contains-track.loader';
import { createPlaylistTracksWithTrackLoader } from './adapters/persistence/repositories/playlist-track/playlist-track-with-track.loader';
import { createPlaylistTracksLoader } from './adapters/persistence/repositories/playlist-track/playlist-track.loader';
import { AdminMethodsModule } from './admin-methods/admin-methods.module';
import {
  IPlaylistStatsQuery,
  PLAYLIST_STATS_QUERY,
} from './application/ports/queries/IPlaylistStatsQuery';
import {
  IPlaylistTrackRepository,
  PLAYLIST_TRACK_REPOSITORY,
} from './application/ports/repositories/IPlaylistTrackRepository';
import { UseCasesModule } from './application/use-cases/use-cases.module';
import { AuthModule as NestJsBetterAuthModule } from '@thallesp/nestjs-better-auth';
import { ConfigModuleSetup, QueueConfig } from './config';
import { GraphiQLModule } from './graphiql/graphiql.module';
import { BetterAuthCatchAllMiddleware } from './infrastructure/auth/better-auth-catch-all.middleware';
import { AuthModule } from './infrastructure/auth/auth.module';
import { BETTER_AUTH_INSTANCE } from './infrastructure/auth/auth.module';
import { AiModule } from './infrastructure/external-services/ai/ai.module';
import { ElasticsearchModule } from './infrastructure/external-services/elasticsearch/elasticsearch.module';
import { NestjsLoggerModule } from './infrastructure/logging/nestjs-logger.module';

@Module({
  imports: [
    AiModule,
    // Configuration module
    ConfigModuleSetup,

    // GraphiQL IDE at GET /graphql (must be before GraphQL module so middleware runs first)
    GraphiQLModule,

    // Clean architecture modules
    AdaptersPersistenceModule,
    UseCasesModule,
    AuthModule,
    NestJsBetterAuthModule.forRootAsync({
      imports: [AuthModule],
      useFactory: (auth) => ({ auth }),
      inject: [BETTER_AUTH_INSTANCE],
      disableGlobalAuthGuard: true, // Keep current behavior; use @AllowAnonymous() / guard when ready to protect routes
    }),

    // GraphQL module
    NestjsGraphQLModule.forRootAsync<ApolloDriverConfig>({
      driver: ApolloDriver,
      imports: [AdaptersPersistenceModule],
      useFactory: (
        configService: ConfigService,
        statsQuery: IPlaylistStatsQuery,
        playlistTrackRepository: IPlaylistTrackRepository,
      ) => ({
        autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
        sortSchema: true,
        playground: false,
        introspection: configService.get<boolean>('app.graphqlIntrospection'),
        subscriptions: {
          'graphql-ws': true,
          'subscriptions-transport-ws': true,
        },
        formatError: (formattedError) => {
          // Remove stacktrace from response (keep it in server logs if needed)
          if (formattedError.extensions?.stacktrace) {
            const { stacktrace: _stacktrace, ...rest } = formattedError.extensions;
            return { ...formattedError, extensions: rest };
          }
          return formattedError;
        },
        context: ({ req, res }: { req: Request; res: Response }) => ({
          req,
          res,
          loaders: {
            playlistStats: createPlaylistStatsLoader(statsQuery),
            playlistTracks: createPlaylistTracksLoader(playlistTrackRepository),
            playlistContainsTrack: createPlaylistContainsTrackLoader(playlistTrackRepository),
            playlistTracksWithTrack: createPlaylistTracksWithTrackLoader(playlistTrackRepository),
          },
        }),
      }),
      inject: [ConfigService, PLAYLIST_STATS_QUERY, PLAYLIST_TRACK_REPOSITORY],
    }),

    // Clean architecture graphql module
    GraphQLModule,

    // Feature modules

    HttpModule,
    AdminMethodsModule,
    ElasticsearchModule,
    BullModule.forRootAsync({
      useFactory: (configService: ConfigService) => {
        const queueConfig = configService.get<QueueConfig>('queue');
        return {
          connection: {
            host: queueConfig?.redis.host,
            port: queueConfig?.redis.port,
            password: queueConfig?.redis.password,
            db: queueConfig?.redis.db,
          },
        };
      },
      inject: [ConfigService],
    }),
    JobSchedulersModule,
    NestjsLoggerModule,
  ],
  providers: [ActionContextMiddleware, BetterAuthCatchAllMiddleware],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(ActionContextMiddleware).forRoutes({ path: '*', method: RequestMethod.ALL });
    // Handle /api/auth and all subpaths (dash, sign-in, etc.); package only registers exact /api/auth
    // path-to-regexp v6 (Express 5): *path for subpaths; exact path for base
    consumer.apply(BetterAuthCatchAllMiddleware).forRoutes(
      { path: 'api/auth', method: RequestMethod.ALL },
      { path: 'api/auth/*path', method: RequestMethod.ALL },
    );
  }
}
