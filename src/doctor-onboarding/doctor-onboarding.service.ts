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
  seedsForSpeciality,
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
      await this.ensureAllTestPatientDoctorAccess();
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
    for (const spec of specialities) {
      await this.ensureTestAccountForSpeciality(spec);
    }
  }

  /** Creates or refreshes the demo patient for one speciality. */
  async ensureTestAccountForSpeciality(spec: DoctorSpeciality): Promise<void> {
    const hash = await bcrypt.hash(this.testPassword(), 10);
    const existing = await this.testAccountRepo.findOne({
      where: { speciality_id: spec.id },
    });
    if (existing) {
      await this.patientProfileRepo.update(
        { user_id: existing.patient_user_id },
        {
          name: DEFAULT_TEST_PATIENT_DISPLAY_NAME,
          medical_records_storage_consent: true,
          medical_records_storage_consent_at: new Date(),
        },
      );
      await this.ensureRecordsForPatient(existing.patient_user_id, spec.name_en);
      await this.grantTestPatientAccessToAllDoctors(existing.patient_user_id);
      return;
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
        {
          name: DEFAULT_TEST_PATIENT_DISPLAY_NAME,
          is_specialty_test_account: true,
          medical_records_storage_consent: true,
          medical_records_storage_consent_at: new Date(),
        },
      );
    }

    await this.testAccountRepo.save(
      this.testAccountRepo.create({
        speciality_id: spec.id,
        patient_user_id: user.id,
      }),
    );

    await this.ensureRecordsForPatient(user.id, spec.name_en);
    await this.grantTestPatientAccessToAllDoctors(user.id);
    this.logger.log(`Specialty test account ready: ${spec.name_en} → ${email}`);
  }

  /** Demo patients always grant record access to every approved doctor. */
  async grantTestPatientAccess(
    patientUserId: string,
    doctorId: string,
  ): Promise<void> {
    let access = await this.accessRepo.findOne({
      where: { patient_user_id: patientUserId, doctor_id: doctorId },
    });
    const now = new Date();
    if (!access) {
      await this.accessRepo.save(
        this.accessRepo.create({
          patient_user_id: patientUserId,
          doctor_id: doctorId,
          records_allowed: true,
          records_allowed_at: now,
          blocked_by_patient: false,
          blocked_by_doctor: false,
        }),
      );
      return;
    }

    if (
      access.records_allowed &&
      !access.blocked_by_patient &&
      !access.blocked_by_doctor
    ) {
      return;
    }

    access.records_allowed = true;
    access.records_allowed_at = access.records_allowed_at ?? now;
    access.blocked_by_patient = false;
    access.blocked_by_doctor = false;
    await this.accessRepo.save(access);
  }

  async grantTestPatientAccessForDoctorUser(
    doctorUserId: string,
    patientUserId: string,
  ): Promise<void> {
    const doctor = await this.doctorRepo.findOne({ where: { user_id: doctorUserId } });
    if (!doctor) return;
    await this.grantTestPatientAccess(patientUserId, doctor.id);
  }

  async grantTestPatientAccessToAllDoctors(patientUserId: string): Promise<void> {
    const doctors = await this.doctorRepo.find({
      where: { approval_status: 'approved' },
      select: ['id'],
    });
    for (const doctor of doctors) {
      await this.grantTestPatientAccess(patientUserId, doctor.id);
    }
  }

  async grantAllTestPatientsAccessToDoctor(doctorId: string): Promise<void> {
    const testAccounts = await this.testAccountRepo.find({ select: ['patient_user_id'] });
    for (const row of testAccounts) {
      await this.grantTestPatientAccess(row.patient_user_id, doctorId);
    }
  }

  /** Backfill access rows for every specialty demo patient × approved doctor. */
  private async ensureAllTestPatientDoctorAccess(): Promise<void> {
    const testAccounts = await this.testAccountRepo.find({ select: ['patient_user_id'] });
    for (const row of testAccounts) {
      await this.grantTestPatientAccessToAllDoctors(row.patient_user_id);
    }
  }

  private async ensureRecordsForPatient(patientUserId: string, specialityName: string) {
    const seeds = seedsForSpeciality(specialityName);

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

    await this.ensureMinimumLabAndXray(patientUserId, specialityName);
  }

  /** Backfill lab + x-ray when older demo accounts are missing either type. */
  private async ensureMinimumLabAndXray(
    patientUserId: string,
    specialityName: string,
  ): Promise<void> {
    const docs = await this.medicalDocRepo.find({ where: { patient_id: patientUserId } });
    const hasLab = docs.some((doc) => doc.type === 'lab');
    const hasXray = docs.some((doc) => doc.type === 'xray');
    if (hasLab && hasXray) return;

    const fallbackSeeds = seedsForSpeciality(specialityName);
    for (const seed of fallbackSeeds) {
      if (seed.type === 'lab' && hasLab) continue;
      if (seed.type === 'xray' && hasXray) continue;
      const exists = docs.some(
        (doc) => doc.type === seed.type && doc.title === seed.title,
      );
      if (exists) continue;
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
  async setupDoctorOnboarding(
    doctorId: string,
    options?: { removeOtherTestPatientChats?: boolean },
  ): Promise<{ test_patient_user_id: string | null }> {
    const doctor = await this.doctorRepo.findOne({ where: { id: doctorId } });
    if (!doctor || doctor.approval_status !== 'approved') {
      return { test_patient_user_id: null };
    }

    if (doctor.speciality_id) {
      const spec = await this.specialityRepo.findOne({
        where: { id: doctor.speciality_id },
      });
      if (spec) {
        await this.ensureTestAccountForSpeciality(spec);
      }
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

    await this.grantTestPatientAccess(testPatientUserId, doctor.id);

    // One demo patient thread per doctor — drop chats with other specialty demos.
    await this.removeOtherTestPatientChats(doctor.user_id, testPatientUserId);

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

  /** Keep only the current specialty demo patient thread for this doctor. */
  async removeOtherTestPatientChats(
    doctorUserId: string,
    keepPatientUserId: string,
  ): Promise<void> {
    const testAccounts = await this.testAccountRepo.find({
      select: ['patient_user_id'],
    });
    const otherPatientIds = testAccounts
      .map((row) => row.patient_user_id)
      .filter((id) => id !== keepPatientUserId);
    if (!otherPatientIds.length) return;

    await this.messageRepo
      .createQueryBuilder()
      .delete()
      .where(
        '(creator = :doctorUserId AND recipient IN (:...otherPatientIds)) OR (creator IN (:...otherPatientIds) AND recipient = :doctorUserId)',
        { doctorUserId, otherPatientIds },
      )
      .execute();
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
