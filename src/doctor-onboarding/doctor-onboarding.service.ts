import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import { Doctor } from '../entities/doctor.entity';
import { DoctorSpeciality } from '../entities/doctor-speciality.entity';
import { DoctorPatientAccess } from '../entities/doctor-patient-access.entity';
import { MedicalDocument } from '../entities/medical-document.entity';
import { Message } from '../entities/message.entity';
import { PatientProfile } from '../entities/patient-profile.entity';
import { SpecialtyTestAccount } from '../entities/specialty-test-account.entity';
import { User, UserRole } from '../entities/user.entity';
import { DEFAULT_MESSAGE_POINTS } from '../points/points.constants';
import {
  DEFAULT_TEST_PATIENT_DISPLAY_NAME,
  DEFAULT_TEST_PATIENT_PASSWORD,
  SPECIALTY_TEST_RECORDS,
  TEST_PATIENT_WELCOME_MESSAGE,
  testPatientEmail,
} from './specialty-test.constants';

@Injectable()
export class DoctorOnboardingService implements OnApplicationBootstrap {
  private readonly logger = new Logger(DoctorOnboardingService.name);

  constructor(
    @InjectRepository(Doctor) private doctorRepo: Repository<Doctor>,
    @InjectRepository(DoctorSpeciality)
    private specialityRepo: Repository<DoctorSpeciality>,
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(PatientProfile)
    private patientProfileRepo: Repository<PatientProfile>,
    @InjectRepository(SpecialtyTestAccount)
    private testAccountRepo: Repository<SpecialtyTestAccount>,
    @InjectRepository(MedicalDocument)
    private medicalDocRepo: Repository<MedicalDocument>,
    @InjectRepository(DoctorPatientAccess)
    private accessRepo: Repository<DoctorPatientAccess>,
    @InjectRepository(Message) private messageRepo: Repository<Message>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      await this.ensureSpecialtyTestAccounts();
    } catch (err) {
      this.logger.error('Failed to seed specialty test accounts', err);
    }
  }

  private testPassword(): string {
    return process.env.SPECIALTY_TEST_PATIENT_PASSWORD?.trim() || DEFAULT_TEST_PATIENT_PASSWORD;
  }

  /** Idempotent — one demo patient per speciality with sample medical records. */
  async ensureSpecialtyTestAccounts(): Promise<void> {
    const specialities = await this.specialityRepo.find({ order: { name_en: 'ASC' } });
    const hash = await bcrypt.hash(this.testPassword(), 10);

    for (const spec of specialities) {
      const existing = await this.testAccountRepo.findOne({
        where: { speciality_id: spec.id },
      });
      if (existing) {
        await this.patientProfileRepo.update(
          { user_id: existing.patient_user_id },
          { name: DEFAULT_TEST_PATIENT_DISPLAY_NAME },
        );
        await this.ensureRecordsForPatient(existing.patient_user_id, spec.name_en);
        continue;
      }

      const email = testPatientEmail(spec.name_en);
      let user = await this.userRepo.findOne({ where: { email } });
      if (!user) {
        user = await this.userRepo.save(
          this.userRepo.create({
            email,
            password_hash: hash,
            role: UserRole.PATIENT,
            preferred_locale: 'en',
            message_points: DEFAULT_MESSAGE_POINTS,
            email_verified_at: new Date(),
          }),
        );

        await this.patientProfileRepo.save(
          this.patientProfileRepo.create({
            user_id: user.id,
            name: DEFAULT_TEST_PATIENT_DISPLAY_NAME,
            phone: '+20000000000',
            country: 'EG',
            medical_records_storage_consent: true,
            medical_records_storage_consent_at: new Date(),
            is_specialty_test_account: true,
          }),
        );
      } else {
        await this.patientProfileRepo.update(
          { user_id: user.id },
          { name: DEFAULT_TEST_PATIENT_DISPLAY_NAME },
        );
      }

      await this.testAccountRepo.save(
        this.testAccountRepo.create({
          speciality_id: spec.id,
          patient_user_id: user.id,
        }),
      );

      await this.ensureRecordsForPatient(user.id, spec.name_en);
      this.logger.log(`Specialty test account ready: ${spec.name_en} → ${email}`);
    }
  }

  private async ensureRecordsForPatient(patientUserId: string, specialityName: string) {
    const seeds = SPECIALTY_TEST_RECORDS[specialityName] ?? SPECIALTY_TEST_RECORDS['General Medicine'];

    for (const seed of seeds) {
      const existing = await this.medicalDocRepo.findOne({
        where: { patient_id: patientUserId, title: seed.title },
      });
      if (existing) {
        const staleAttachment =
          existing.file_url !== seed.file_url ||
          existing.file_name !== seed.file_name ||
          existing.notes !== seed.notes ||
          existing.type !== seed.type ||
          existing.body_part !== seed.body_part;
        if (staleAttachment) {
          await this.medicalDocRepo.update(existing.id, {
            type: seed.type,
            notes: seed.notes,
            body_part: seed.body_part,
            file_url: seed.file_url,
            file_name: seed.file_name,
          });
        }
        continue;
      }
      await this.medicalDocRepo.save(
        this.medicalDocRepo.create({
          patient_id: patientUserId,
          type: seed.type,
          title: seed.title,
          notes: seed.notes,
          body_part: seed.body_part,
          file_url: seed.file_url,
          file_name: seed.file_name,
        }),
      );
    }
  }

  async resolveTestPatientForDoctor(doctor: Doctor): Promise<string | null> {
    const specialityId = doctor.speciality_id;
    if (!specialityId) return null;
    const row = await this.testAccountRepo.findOne({ where: { speciality_id: specialityId } });
    return row?.patient_user_id ?? null;
  }

  /** Links the doctor to their specialty test patient: chat, access, welcome message. */
  async setupDoctorOnboarding(doctorId: string): Promise<{ test_patient_user_id: string | null }> {
    const doctor = await this.doctorRepo.findOne({ where: { id: doctorId } });
    if (!doctor || doctor.approval_status !== 'approved') {
      return { test_patient_user_id: null };
    }

    const testPatientUserId = await this.resolveTestPatientForDoctor(doctor);
    if (!testPatientUserId) {
      return { test_patient_user_id: null };
    }

    if (doctor.onboarding_test_patient_user_id !== testPatientUserId) {
      await this.doctorRepo.update(doctor.id, {
        onboarding_test_patient_user_id: testPatientUserId,
      });
    }

    let access = await this.accessRepo.findOne({
      where: { patient_user_id: testPatientUserId, doctor_id: doctor.id },
    });
    if (!access) {
      access = await this.accessRepo.save(
        this.accessRepo.create({
          patient_user_id: testPatientUserId,
          doctor_id: doctor.id,
          records_allowed: true,
          records_allowed_at: new Date(),
          blocked_by_patient: false,
          blocked_by_doctor: false,
        }),
      );
    } else if (!access.records_allowed) {
      access.records_allowed = true;
      access.records_allowed_at = new Date();
      await this.accessRepo.save(access);
    }

    const existingWelcome = await this.messageRepo.findOne({
      where: {
        creator: testPatientUserId,
        recipient: doctor.user_id,
        content: TEST_PATIENT_WELCOME_MESSAGE,
      },
    });
    if (!existingWelcome) {
      await this.messageRepo.save(
        this.messageRepo.create({
          type: 'text',
          content: TEST_PATIENT_WELCOME_MESSAGE,
          creator: testPatientUserId,
          recipient: doctor.user_id,
          datetime: new Date(),
        }),
      );
    }

    return { test_patient_user_id: testPatientUserId };
  }

  async markTourComplete(
    userId: string,
    kind: 'product' | 'profile',
  ): Promise<Doctor | null> {
    const doctor = await this.doctorRepo.findOne({ where: { user_id: userId } });
    if (!doctor) return null;
    const patch =
      kind === 'profile'
        ? { profile_tour_completed_at: new Date() }
        : { product_tour_completed_at: new Date() };
    await this.doctorRepo.update(doctor.id, patch);
    return this.doctorRepo.findOne({ where: { id: doctor.id } });
  }
}
