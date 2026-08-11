import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';
import { RedisIoAdapter } from './presence/redis-io.adapter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });

  const redisUrl = process.env.REDIS_URL?.trim();
  const ioAdapter = new RedisIoAdapter(app);
  if (redisUrl) {
    await ioAdapter.connectToRedis(redisUrl);
    console.log('Socket.IO using Redis adapter');
  }
  app.useWebSocketAdapter(ioAdapter);

  // Behind a load balancer/CDN: makes req.ip the real client address, which
  // the GeoIP-based credit pricing depends on.
  app.getHttpAdapter().getInstance().set('trust proxy', true);

  app.use(json({ limit: '12mb' }));
  app.use(urlencoded({ extended: true, limit: '12mb' }));

  app.setGlobalPrefix('3eyadahub-api');

  app.enableCors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
    allowedHeaders: '*',
    exposedHeaders: '*',
    credentials: false,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  const port = process.env.PORT || 8080;
  await app.listen(port);
  console.log(`3eyadahub-api running on port ${port}`);
}

bootstrap();
