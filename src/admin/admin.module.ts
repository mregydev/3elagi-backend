import { Module, OnApplicationBootstrap } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as multer from 'multer';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { User } from '../entities/user.entity';
import { Doctor } from '../entities/doctor.entity';
import { Clinic } from '../entities/clinic.entity';
import { PatientProfile } from '../entities/patient-profile.entity';
import { AdminRagSource } from '../entities/admin-rag-source.entity';
import { IntakeTest } from '../entities/intake-test.entity';
import { IntakeTestsModule } from '../intake-tests/intake-tests.module';
import { AiModule } from '../ai/ai.module';
import { PresenceModule } from '../presence/presence.module';
import { PushNotificationsModule } from '../push-notifications/push-notifications.module';
import { PointsModule } from '../points/points.module';
import { SpecialitiesModule } from '../specialities/specialities.module';
import { UploadsModule } from '../uploads/uploads.module';
import { ContactModule } from '../contact/contact.module';
import { DoctorRegistrationRequestsModule } from '../doctor-registration-requests/doctor-registration-requests.module';

@Module({
  imports: [
    MulterModule.register({
      storage: multer.memoryStorage(),
      limits: { fileSize: 200 * 1024 * 1024 },
    }),
    TypeOrmModule.forFeature([
      User,
      Doctor,
      Clinic,
      PatientProfile,
      AdminRagSource,
      IntakeTest,
    ]),
    IntakeTestsModule,
    AiModule,
    PresenceModule,
    PushNotificationsModule,
    PointsModule,
    SpecialitiesModule,
    UploadsModule,
    ContactModule,
    DoctorRegistrationRequestsModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule implements OnApplicationBootstrap {
  constructor(private readonly service: AdminService) {}
  async onApplicationBootstrap(): Promise<void> {
    try {
      await this.service.ensureAdmin();
    } catch (err) {
      // Non-fatal — log and continue. The platform admin can be created later via SQL.
      console.error('[admin seed] failed to ensure admin user:', err);
    }
  }
}
