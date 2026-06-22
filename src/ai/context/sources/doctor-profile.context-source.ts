import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Doctor } from '../../../entities/doctor.entity';
import { UserRole } from '../../../entities/user.entity';
import { buildDoctorProfileText } from '../../knowledge-text.builder';
import type { AIContextSource } from '../ai-context-source.interface';
import type { AiContextUser, AiIntent } from '../ai-context.types';

@Injectable()
export class DoctorProfileContextSource implements AIContextSource {
  readonly name = 'doctor_profile';

  constructor(
    @InjectRepository(Doctor)
    private readonly doctorRepo: Repository<Doctor>,
  ) {}

  canHandle(_question: string, intent: AiIntent): boolean {
    return (
      intent === 'patient_profile_question' ||
      intent === 'doctor_profile_question' ||
      intent === 'doctor_practice_question' ||
      intent === 'mixed_question'
    );
  }

  async fetchContext(user: AiContextUser): Promise<Doctor | null> {
    if (user.role !== UserRole.DOCTOR) return null;
    return this.doctorRepo.findOne({
      where: { user_id: user.id },
      relations: ['speciality'],
    });
  }

  buildContextText(data: unknown): string {
    const doctor = data as Doctor | null;
    if (!doctor) return '';
    return `[Your Doctor Profile]\n${buildDoctorProfileText(doctor, doctor.speciality ?? null)}`;
  }

  async getVersionKey(user: AiContextUser): Promise<string> {
    if (user.role !== UserRole.DOCTOR) return 'doctor_profile:skip';
    const doctor = await this.doctorRepo.findOne({
      where: { user_id: user.id },
      select: ['id', 'updated_at'],
    });
    return doctor
      ? `doctor_profile:${doctor.id}:${doctor.updated_at?.getTime() ?? 0}`
      : 'doctor_profile:none';
  }
}
