import { Module } from '@nestjs/common';
import { PresenceGateway } from './presence.gateway';
import { PresenceService } from './presence.service';

@Module({
  providers: [PresenceService, PresenceGateway],
  exports: [PresenceService, PresenceGateway],
})
export class PresenceModule {}
