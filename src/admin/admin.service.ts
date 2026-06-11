import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from '../entities/user.entity';
import { Doctor, ApprovalStatus } from '../entities/doctor.entity';
import { Clinic } from '../entities/clinic.entity';
import { PatientProfile } from '../entities/patient-profile.entity';
import {
  IntakeTest,
  IntakeQuestion,
} from '../entities/intake-test.entity';
import { IntakeTestsService } from '../intake-tests/intake-tests.service';
import { KnowledgeIndexerService } from '../ai/knowledge-indexer.service';

const APPROVAL_VALUES: ApprovalStatus[] = ['pending', 'approved', 'rejected'];

interface UpdateDoctorDto {
  name?: string;
  phone?: string;
  age?: number;
  email?: string;
  photo_url?: string;
  professional_title?: string | null;
  description?: string | null;
  experience_years?: number | null;
  consultation_fee_egp?: number | null;
}

interface UpdatePatientDto {
  name?: string;
  phone?: string;
  birth_date?: string | null;
  gender?: string | null;
  chronic_conditions?: string | null;
  allergies?: string | null;
  medical_notes?: string | null;
  photo_url?: string | null;
}

interface UpsertDefaultIntakeDto {
  name: string;
  description?: string;
  is_active?: boolean;
  questions: IntakeQuestion[];
}

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Doctor) private doctorRepo: Repository<Doctor>,
    @InjectRepository(Clinic) private clinicRepo: Repository<Clinic>,
    @InjectRepository(PatientProfile)
    private patientRepo: Repository<PatientProfile>,
    @InjectRepository(IntakeTest) private intakeRepo: Repository<IntakeTest>,
    private intakeService: IntakeTestsService,
    private knowledgeIndexer: KnowledgeIndexerService,
  ) {}

  // ----- Doctors -----
  listDoctors() {
    return this.doctorRepo.find({ order: { name: 'ASC' } });
  }

  async updateDoctor(id: string, dto: UpdateDoctorDto) {
    const doc = await this.doctorRepo.findOne({ where: { id } });
    if (!doc) throw new NotFoundException('Doctor not found');
    const safe: Partial<Doctor> = {};
    if (dto.name !== undefined) safe.name = dto.name;
    if (dto.phone !== undefined) safe.phone = dto.phone;
    if (dto.age !== undefined) safe.age = dto.age;
    if (dto.email !== undefined) safe.email = dto.email;
    if (dto.photo_url !== undefined) safe.photo_url = dto.photo_url;
    if (dto.professional_title !== undefined) safe.professional_title = dto.professional_title;
    if (dto.description !== undefined) safe.description = dto.description;
    if (dto.experience_years !== undefined) safe.experience_years = dto.experience_years;
    if (dto.consultation_fee_egp !== undefined) safe.consultation_fee_egp = dto.consultation_fee_egp;
    if (Object.keys(safe).length) await this.doctorRepo.update(id, safe);
    if (dto.email !== undefined && doc.user_id) {
      await this.userRepo.update(doc.user_id, { email: dto.email });
    }
    return this.doctorRepo.findOne({ where: { id } });
  }

  async setDoctorApproval(id: string, status: ApprovalStatus) {
    if (!APPROVAL_VALUES.includes(status)) {
      throw new BadRequestException('Invalid approval status');
    }
    const doc = await this.doctorRepo.findOne({ where: { id } });
    if (!doc) throw new NotFoundException('Doctor not found');
    await this.doctorRepo.update(id, { approval_status: status });
    // Personal clinic of this doctor mirrors approval.
    if (doc.default_clinic_id) {
      await this.clinicRepo.update(
        { id: doc.default_clinic_id, is_personal: true },
        { approval_status: status },
      );
    }
    void this.knowledgeIndexer.indexDoctor(id).catch(() => undefined);
    return this.doctorRepo.findOne({ where: { id } });
  }

  // ----- Clinics -----
  listClinics() {
    return this.clinicRepo.find({ order: { name: 'ASC' } });
  }

  async setClinicApproval(id: string, status: ApprovalStatus) {
    if (!APPROVAL_VALUES.includes(status)) {
      throw new BadRequestException('Invalid approval status');
    }
    const c = await this.clinicRepo.findOne({ where: { id } });
    if (!c) throw new NotFoundException('Clinic not found');
    await this.clinicRepo.update(id, { approval_status: status });
    return this.clinicRepo.findOne({ where: { id } });
  }

  async deleteDoctor(id: string) {
    const doc = await this.doctorRepo.findOne({ where: { id } });
    if (!doc) throw new NotFoundException('Doctor not found');
    await this.doctorRepo.delete(id);
    if (doc.user_id) {
      await this.userRepo.delete(doc.user_id);
    }
    return { ok: true };
  }

  // ----- Patients -----
  listPatients() {
    return this.patientRepo.find({ order: { name: 'ASC' } });
  }

  async updatePatient(userId: string, dto: UpdatePatientDto) {
    const p = await this.patientRepo.findOne({ where: { user_id: userId } });
    if (!p) throw new NotFoundException('Patient not found');
    const safe: Partial<PatientProfile> = {};
    if (dto.name !== undefined) safe.name = dto.name;
    if (dto.phone !== undefined) safe.phone = dto.phone;
    if (dto.birth_date !== undefined) safe.birth_date = dto.birth_date;
    if (dto.gender !== undefined) safe.gender = dto.gender;
    if (dto.chronic_conditions !== undefined)
      safe.chronic_conditions = dto.chronic_conditions;
    if (dto.allergies !== undefined) safe.allergies = dto.allergies;
    if (dto.medical_notes !== undefined) safe.medical_notes = dto.medical_notes;
    if (dto.photo_url !== undefined) safe.photo_url = dto.photo_url;
    await this.patientRepo.update(userId, safe);
    return this.patientRepo.findOne({ where: { user_id: userId } });
  }

  async deletePatient(userId: string) {
    const p = await this.patientRepo.findOne({ where: { user_id: userId } });
    if (!p) throw new NotFoundException('Patient not found');
    await this.patientRepo.delete(userId);
    await this.userRepo.delete(userId);
    return { ok: true };
  }

  // ----- Default intake template -----
  async getDefaultIntake(): Promise<IntakeTest | null> {
    return this.intakeRepo.findOne({
      where: { is_default_template: true },
    });
  }

  async upsertDefaultIntake(dto: UpsertDefaultIntakeDto): Promise<IntakeTest> {
    if (!dto?.name || !dto.name.trim()) {
      throw new BadRequestException('Test name is required');
    }
    const questions = this.intakeService.normalizeQuestions(dto.questions);
    const existing = await this.intakeRepo.findOne({
      where: { is_default_template: true },
    });
    if (existing) {
      existing.name = dto.name.trim();
      existing.description =
        typeof dto.description === 'string'
          ? dto.description.trim() || null
          : null;
      existing.is_active = dto.is_active !== false;
      existing.questions = questions;
      return this.intakeRepo.save(existing);
    }
    const created = this.intakeRepo.create({
      doctor_id: null,
      is_default_template: true,
      name: dto.name.trim(),
      description:
        typeof dto.description === 'string'
          ? dto.description.trim() || null
          : null,
      is_active: dto.is_active !== false,
      questions,
    });
    return this.intakeRepo.save(created);
  }

  // Used by the auth seed to ensure exactly one admin user exists.
  async ensureAdminUser(repoUser: User | null): Promise<void> {
    void repoUser; // (no-op marker)
  }

  // For audit / counts later.
  async stats() {
    const [doctors, patients] = await Promise.all([
      this.doctorRepo.count(),
      this.patientRepo.count(),
    ]);
    return { doctors, patients };
  }

  ensureAdmin = async (): Promise<void> => {
    const existing = await this.userRepo.findOne({
      where: { role: UserRole.ADMIN },
    });
    if (existing) return;
    // Defer to AuthService for hashing — keep direct here too via bcrypt to avoid cycles.
    const bcrypt = await import('bcryptjs');
    const hash = await bcrypt.hash('admin', 10);
    const u = this.userRepo.create({
      email: 'admin',
      password_hash: hash,
      role: UserRole.ADMIN,
    });
    await this.userRepo.save(u);
  };
}
