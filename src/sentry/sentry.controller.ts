import { Controller, Get } from '@nestjs/common';
import { SentryService } from './sentry.service';

@Controller('sentry')
export class SentryController {
  constructor(private readonly sentryService: SentryService) {}

  @Get('logs')
  x§() {
    return this.sentryService.fetchOrthMessageCompletedLogs();
  }
}
