import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { getGraphiQLHtml } from './graphiql.html';

@Injectable()
export class GraphiQLMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    if (req.method !== 'GET') {
      next();
      return;
    }
    const path = req.path.endsWith('/') ? req.path.slice(0, -1) : req.path;
    if (path !== '/graphql' && path !== 'graphql') {
      next();
      return;
    }
    const host = req.get('host') ?? req.hostname;
    const apiPath = `${req.protocol}://${host}/graphql`;
    const wsProtocol = req.protocol === 'https' ? 'wss' : 'ws';
    const subscriptionUrl = `${wsProtocol}://${host}/graphql`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(getGraphiQLHtml(apiPath, subscriptionUrl));
  }
}
