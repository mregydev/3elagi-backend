import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Clinic } from './entities/clinic.entity';
import { Doctor } from './entities/doctor.entity';
import { ClinicJoinRequest } from './entities/clinic-join-request.entity';
import { Patient } from './entities/patient.entity';
import { Appointment } from './entities/appointment.entity';
import { MedicalDocument } from './entities/medical-document.entity';
import { Diagnosis } from './entities/diagnosis.entity';
import { Symptom } from './entities/symptom.entity';
import { Prescription } from './entities/prescription.entity';
import { PrescriptionTemplate } from './entities/prescription-template.entity';
import { IntakeTest } from './entities/intake-test.entity';
import { PatientProfile } from './entities/patient-profile.entity';
import { DoctorSchedule } from './entities/doctor-schedule.entity';
import { DoctorScheduleOverride } from './entities/doctor-schedule-override.entity';
import { InitialSchema1777599963712 } from './migrations/1777599963712-InitialSchema';
import { AddIsPersonalToClinic1777600000001 } from './migrations/1777600000001-AddIsPersonalToClinic';
import { PrescriptionsAndSettings1777800000000 } from './migrations/1777800000000-PrescriptionsAndSettings';
import { PrescriptionTemplates1777810000000 } from './migrations/1777810000000-PrescriptionTemplates';
import { AddClinicLogo1777820000000 } from './migrations/1777820000000-AddClinicLogo';
import { IntakeTests1777830000000 } from './migrations/1777830000000-IntakeTests';
import { PatientPortal1777840000000 } from './migrations/1777840000000-PatientPortal';
import { ScheduleOverrides1777850000000 } from './migrations/1777850000000-ScheduleOverrides';
import { AdminAndIntakeSimplify1777860000000 } from './migrations/1777860000000-AdminAndIntakeSimplify';
import { PatientPhotoAndIntakeEndpoints1777870000000 } from './migrations/1777870000000-PatientPhotoAndIntakeEndpoints';
import { DoctorProfileAndApproval1777880000000 } from './migrations/1777880000000-DoctorProfileAndApproval';
import { DoctorFaqsAndReviews1777890000000 } from './migrations/1777890000000-DoctorFaqsAndReviews';
import { DoctorTags1777900000000 } from './migrations/1777900000000-DoctorTags';
import { PatientOnboardingIntake1777910000000 } from './migrations/1777910000000-PatientOnboardingIntake';
import { AppointmentHideName1777920000000 } from './migrations/1777920000000-AppointmentHideName';
import { AppointmentApproval1777930000000 } from './migrations/1777930000000-AppointmentApproval';
import { DiagnosisAndSymptoms1777940000000 } from './migrations/1777940000000-DiagnosisAndSymptoms';
import { AddPatientsPhotoUrl1777950000000 } from './migrations/1777950000000-AddPatientsPhotoUrl';
import { AddUsersPhotoUrl1777960000000 } from './migrations/1777960000000-AddUsersPhotoUrl';
import { MedicalDocumentsTitle1777970000000 } from './migrations/1777970000000-MedicalDocumentsTitle';
import { DoctorReview } from './entities/review.entity';
import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';
import { ClinicsModule } from './clinics/clinics.module';
import { DoctorsModule } from './doctors/doctors.module';
import { JoinRequestsModule } from './join-requests/join-requests.module';
import { PatientsModule } from './patients/patients.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { MedicalDocumentsModule } from './medical-documents/medical-documents.module';
import { PrescriptionsModule } from './prescriptions/prescriptions.module';
import { PrescriptionTemplatesModule } from './prescription-templates/prescription-templates.module';
import { IntakeTestsModule } from './intake-tests/intake-tests.module';
import { SchedulesModule } from './schedules/schedules.module';
import { PatientPortalModule } from './patient-portal/patient-portal.module';
import { ReviewsModule } from './reviews/reviews.module';
import { UploadsModule } from './uploads/uploads.module';
import { HealthModule } from './health/health.module';
import { UsersModule } from './users/users.module';
import { DiagnosisModule } from './diagnosis/diagnosis.module';
import { SymptomsModule } from './symptoms/symptoms.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        url: configService.get<string>('DATABASE_URL'),
        entities: [
          User,
          Clinic,
          Doctor,
          ClinicJoinRequest,
          Patient,
          Appointment,
          MedicalDocument,
          Diagnosis,
          Symptom,
          Prescription,
          PrescriptionTemplate,
          IntakeTest,
          PatientProfile,
          DoctorSchedule,
          DoctorScheduleOverride,
          DoctorReview,
        ],
        synchronize: false,
        migrations: [
          InitialSchema1777599963712,
          AddIsPersonalToClinic1777600000001,
          PrescriptionsAndSettings1777800000000,
          PrescriptionTemplates1777810000000,
          AddClinicLogo1777820000000,
          IntakeTests1777830000000,
          PatientPortal1777840000000,
          ScheduleOverrides1777850000000,
          AdminAndIntakeSimplify1777860000000,
          PatientPhotoAndIntakeEndpoints1777870000000,
          DoctorProfileAndApproval1777880000000,
          DoctorFaqsAndReviews1777890000000,
          DoctorTags1777900000000,
          PatientOnboardingIntake1777910000000,
          AppointmentHideName1777920000000,
          AppointmentApproval1777930000000,
          DiagnosisAndSymptoms1777940000000,
          AddPatientsPhotoUrl1777950000000,
          AddUsersPhotoUrl1777960000000,
          MedicalDocumentsTitle1777970000000,
        ],
        migrationsRun: true,
        migrationsTransactionMode: 'each',
        ssl: {
          rejectUnauthorized: false,
        },
        logging: false,
      }),
      inject: [ConfigService],
    }),
    AuthModule,
    ClinicsModule,
    DoctorsModule,
    JoinRequestsModule,
    PatientsModule,
    AppointmentsModule,
    MedicalDocumentsModule,
    DiagnosisModule,
    SymptomsModule,
    PrescriptionsModule,
    PrescriptionTemplatesModule,
    IntakeTestsModule,
    SchedulesModule,
    PatientPortalModule,
    ReviewsModule,
    UploadsModule,
    HealthModule,
    UsersModule,
    AdminModule,
  ],
})
export class AppModule {}
