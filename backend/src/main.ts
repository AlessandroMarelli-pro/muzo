import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bodyParser: false, // Required for Better Auth; @thallesp/nestjs-better-auth applies body parsing per-route
  });

  app.enableCors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3001',
    credentials: true,
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`🚀 Muzo Backend running on http://localhost:${port}`);
}

bootstrap();
