import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Symptom } from '../entities/symptom.entity';
import { Diagnosis } from '../entities/diagnosis.entity';
import { Doctor } from '../entities/doctor.entity';
import { CreateSymptomDto } from './dto/create-symptom.dto';
import { UpdateSymptomDto } from './dto/update-symptom.dto';

@Injectable()
export class SymptomsService {
  constructor(
    @InjectRepository(Symptom) private symptomRepo: Repository<Symptom>,
    @InjectRepository(Diagnosis) private diagnosisRepo: Repository<Diagnosis>,
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

  private async assertDiagnosisAccess(diagnosisId: string, doctor: Doctor): Promise<Diagnosis> {
    const diagnosis = await this.diagnosisRepo.findOne({ where: { id: diagnosisId } });
    if (!diagnosis) throw new NotFoundException('Diagnosis not found');
    if (diagnosis.doctor_id !== doctor.id) {
      throw new ForbiddenException('You do not have access to this diagnosis');
    }
    return diagnosis;
  }

  async findAll(diagnosisId: string | undefined, userId: string, userRole: string) {
    const doctor = await this.assertDoctorUser(userId, userRole);
    if (diagnosisId) {
      await this.assertDiagnosisAccess(diagnosisId, doctor);
      return this.symptomRepo.find({
        where: { diagnosis_id: diagnosisId },
        order: { created_at: 'DESC' },
      });
    }
    const diagnoses = await this.diagnosisRepo.find({
      where: { doctor_id: doctor.id },
      select: ['id'],
    });
    const ids = diagnoses.map((d) => d.id);
    if (!ids.length) return [];
    return this.symptomRepo
      .createQueryBuilder('s')
      .where('s.diagnosis_id IN (:...ids)', { ids })
      .orderBy('s.created_at', 'DESC')
      .getMany();
  }

  async findOne(id: string, userId: string, userRole: string) {
    const doctor = await this.assertDoctorUser(userId, userRole);
    const row = await this.symptomRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Symptom not found');
    await this.assertDiagnosisAccess(row.diagnosis_id, doctor);
    return row;
  }

  async create(dto: CreateSymptomDto, userId: string, userRole: string) {
    const doctor = await this.assertDoctorUser(userId, userRole);
    await this.assertDiagnosisAccess(dto.diagnosis_id, doctor);
    const row = this.symptomRepo.create({
      ...dto,
      doctor_id: doctor.id,
    });
    return this.symptomRepo.save(row);
  }

  async update(id: string, dto: UpdateSymptomDto, userId: string, userRole: string) {
    const doctor = await this.assertDoctorUser(userId, userRole);
    const row = await this.symptomRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Symptom not found');
    await this.assertDiagnosisAccess(row.diagnosis_id, doctor);
    if (dto.diagnosis_id) {
      await this.assertDiagnosisAccess(dto.diagnosis_id, doctor);
    }
    Object.assign(row, dto);
    return this.symptomRepo.save(row);
  }
}
