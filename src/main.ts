import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { json, urlencoded } from 'express';
import * as cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { RedisIoAdapter } from './presence/redis-io.adapter';
import { corsOriginDelegate } from './auth/auth-cookies';

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
  app.use(cookieParser());

  app.setGlobalPrefix('3eyadahub-api');

  const config = app.get(ConfigService);
  app.enableCors({
    origin: corsOriginDelegate(config),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Auth-Client'],
    exposedHeaders: ['Set-Cookie'],
    credentials: true,
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
