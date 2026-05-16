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
import { CreateDiagnosisDto } from './dto/create-diagnosis.dto';
import { UpdateDiagnosisDto } from './dto/update-diagnosis.dto';

@Injectable()
export class DiagnosisService {
  constructor(
    @InjectRepository(Diagnosis) private diagnosisRepo: Repository<Diagnosis>,
    @InjectRepository(Patient) private patientRepo: Repository<Patient>,
    @InjectRepository(Doctor) private doctorRepo: Repository<Doctor>,
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

  async create(dto: CreateDiagnosisDto, userId: string, userRole: string) {
    const doctor = await this.assertDoctorUser(userId, userRole);
    const patient = await this.patientRepo.findOne({ where: { id: dto.patient_id } });
    if (!patient) throw new NotFoundException('Patient not found');
    const targetDoctor = await this.doctorRepo.findOne({ where: { id: dto.doctor_id } });
    if (!targetDoctor) throw new NotFoundException('Doctor not found');
    if (targetDoctor.id !== doctor.id) {
      throw new ForbiddenException('You can only create diagnoses for yourself as doctor');
    }
    const row = this.diagnosisRepo.create(dto);
    return this.diagnosisRepo.save(row);
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
