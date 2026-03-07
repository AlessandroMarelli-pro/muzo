import { Module, NestModule } from '@nestjs/common';
import { MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { GraphiQLMiddleware } from './graphiql.middleware';

@Module({})
export class GraphiQLModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(GraphiQLMiddleware).forRoutes({ path: 'graphql', method: RequestMethod.GET });
  }
}
