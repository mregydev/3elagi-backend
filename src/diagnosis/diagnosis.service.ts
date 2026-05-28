import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Diagnosis } from '../entities/diagnosis.entity';
import { Patient } from '../entities/patient.entity';
import { Doctor } from '../entities/doctor.entity';
import { Symptom } from '../entities/symptom.entity';
import { User, UserRole } from '../entities/user.entity';
import { CreateDiagnosisDto } from './dto/create-diagnosis.dto';
import { CreatePatientDiagnosisDto } from './dto/create-patient-diagnosis.dto';
import { UpdateDiagnosisDto } from './dto/update-diagnosis.dto';

@Injectable()
export class DiagnosisService {
  constructor(
    @InjectRepository(Diagnosis) private diagnosisRepo: Repository<Diagnosis>,
    @InjectRepository(Patient) private patientRepo: Repository<Patient>,
    @InjectRepository(Doctor) private doctorRepo: Repository<Doctor>,
    @InjectRepository(Symptom) private symptomRepo: Repository<Symptom>,
    @InjectRepository(User) private userRepo: Repository<User>,
  ) {}

  private async assertDoctorUser(userId: string, userRole: string): Promise<Doctor> {
    if (userRole !== 'doctor') {
      throw new ForbiddenException('Insufficient role');
    }
    const doctor = await this.doctorRepo.findOne({ where: { user_id: userId } });
    if (!doctor) throw new ForbiddenException('Doctor profile not found');
    return doctor;
  }

  async findAll(patientId: string | undefined, userId: string, userRole: string) {
    await this.assertDoctorUser(userId, userRole);
    const where = patientId ? { patient_id: patientId } : {};
    return this.diagnosisRepo.find({
      where,
      order: { created_at: 'DESC' },
      relations: ['symptoms'],
    });
  }

  async findOne(id: string, userId: string, userRole: string) {
    await this.assertDoctorUser(userId, userRole);
    const row = await this.diagnosisRepo.findOne({
      where: { id },
      relations: ['symptoms'],
    });
    if (!row) throw new NotFoundException('Diagnosis not found');
    return row;
  }

  async findForPatientUser(userId: string) {
    return this.diagnosisRepo.find({
      where: { patient_id: userId },
      order: { created_at: 'DESC' },
      relations: ['symptoms'],
    });
  }

  async findOneForPatientUser(id: string, userId: string) {
    const row = await this.diagnosisRepo.findOne({
      where: { id, patient_id: userId },
      relations: ['symptoms'],
    });
    if (!row) throw new NotFoundException('Diagnosis not found');
    return row;
  }

  private async saveSymptoms(
    diagnosisId: string,
    symptoms: { desc: string }[] | undefined,
  ): Promise<void> {
    if (!symptoms?.length) return;
    const rows = symptoms
      .map((s) => s.desc.trim())
      .filter(Boolean)
      .map((desc) =>
        this.symptomRepo.create({ desc, diagnosis_id: diagnosisId }),
      );
    if (rows.length) await this.symptomRepo.save(rows);
  }

  async createForPatientUser(userId: string, dto: CreatePatientDiagnosisDto) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user || user.role !== UserRole.PATIENT) {
      throw new ForbiddenException('Only patients can create self-reported diagnoses');
    }
    const row = this.diagnosisRepo.create({
      desc: dto.desc.trim(),
      patient_id: userId,
      doctor_id: null,
    });
    const saved = await this.diagnosisRepo.save(row);
    await this.saveSymptoms(saved.id, dto.symptoms);
    return this.findOneForPatientUser(saved.id, userId);
  }

  async addSymptomForPatientUser(
    diagnosisId: string,
    userId: string,
    desc: string,
  ) {
    await this.findOneForPatientUser(diagnosisId, userId);
    const row = this.symptomRepo.create({
      desc: desc.trim(),
      diagnosis_id: diagnosisId,
    });
    await this.symptomRepo.save(row);
    return this.findOneForPatientUser(diagnosisId, userId);
  }

  async create(dto: CreateDiagnosisDto, userId: string, userRole: string) {
    const doctor = await this.assertDoctorUser(userId, userRole);
    const patientUser = await this.userRepo.findOne({ where: { id: dto.patient_id } });
    if (!patientUser || patientUser.role !== UserRole.PATIENT) {
      throw new NotFoundException('Patient user not found');
    }
    const targetDoctor = await this.doctorRepo.findOne({ where: { id: dto.doctor_id } });
    if (!targetDoctor) throw new NotFoundException('Doctor not found');
    if (targetDoctor.id !== doctor.id) {
      throw new ForbiddenException('You can only create diagnoses for yourself as doctor');
    }
    const { symptoms, ...diagnosisFields } = dto;
    const row = this.diagnosisRepo.create(diagnosisFields);
    const saved = await this.diagnosisRepo.save(row);
    await this.saveSymptoms(saved.id, symptoms);
    return this.findOne(saved.id, userId, userRole);
  }

  async update(id: string, dto: UpdateDiagnosisDto, userId: string, userRole: string) {
    const doctor = await this.assertDoctorUser(userId, userRole);
    const row = await this.diagnosisRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Diagnosis not found');
    if (row.doctor_id !== doctor.id) {
      throw new ForbiddenException('You can only update your own diagnoses');
    }
    if (dto.patient_id) {
      const patient = await this.patientRepo.findOne({ where: { id: dto.patient_id } });
      if (!patient) throw new NotFoundException('Patient not found');
    }
    if (dto.doctor_id && dto.doctor_id !== doctor.id) {
      throw new ForbiddenException('You cannot reassign diagnosis to another doctor');
    }
    Object.assign(row, dto);
    return this.diagnosisRepo.save(row);
  }
}
