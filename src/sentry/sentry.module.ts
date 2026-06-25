import { Module } from '@nestjs/common';
import { SentryController } from './sentry.controller';
import { SentryService } from './sentry.service';

@Module({
  controllers: [SentryController],
  providers: [SentryService],
})
export class SentryModule {}
