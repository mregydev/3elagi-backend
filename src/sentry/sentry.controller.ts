import { Controller, Get } from '@nestjs/common';
import { SentryService } from './sentry.service';

@Controller('sentry')
export class SentryController {
  constructor(private readonly sentryService: SentryService) {}

  @Get('logs')
  getLogs() {
    return this.sentryService.fetchOrthMessageCompletedLogs();
  }
}
