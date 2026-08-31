import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { User } from '../entities/user.entity';
import { Clinic } from '../entities/clinic.entity';
import { Doctor } from '../entities/doctor.entity';
import { DoctorSpeciality } from '../entities/doctor-speciality.entity';
import { PatientProfile } from '../entities/patient-profile.entity';
import { RefreshToken } from '../entities/refresh-token.entity';
import { PresenceModule } from '../presence/presence.module';
import { SpecialitiesModule } from '../specialities/specialities.module';
import { MailModule } from '../mail/mail.module';
import { GoogleOAuthService } from './google-oauth.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Clinic,
      Doctor,
      DoctorSpeciality,
      PatientProfile,
      RefreshToken,
    ]),
    PresenceModule,
    SpecialitiesModule,
    MailModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: '1d' },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, GoogleOAuthService],
  exports: [JwtModule, AuthService],
})
export class AuthModule {}
