import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PresenceGateway } from './presence.gateway';
import { PresenceService } from './presence.service';

@Module({
  imports: [
    // Registered here rather than importing AuthModule, which already imports
    // this module — the gateway only needs to verify the handshake token.
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [PresenceService, PresenceGateway],
  exports: [PresenceService, PresenceGateway],
})
export class PresenceModule {}
