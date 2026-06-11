import { Module, OnApplicationBootstrap } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { User } from '../entities/user.entity';
import { Doctor } from '../entities/doctor.entity';
import { Clinic } from '../entities/clinic.entity';
import { PatientProfile } from '../entities/patient-profile.entity';
import { IntakeTest } from '../entities/intake-test.entity';
import { IntakeTestsModule } from '../intake-tests/intake-tests.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Doctor, Clinic, PatientProfile, IntakeTest]),
    IntakeTestsModule,
    AiModule,
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
