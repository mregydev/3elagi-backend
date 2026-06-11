import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PatientProfile } from '../../../entities/patient-profile.entity';
import { buildPatientProfileText } from '../../knowledge-text.builder';
import type { AIContextSource } from '../ai-context-source.interface';
import type { AiContextUser, AiIntent } from '../ai-context.types';

@Injectable()
export class PatientProfileContextSource implements AIContextSource {
  readonly name = 'patient_profile';

  constructor(
    @InjectRepository(PatientProfile)
    private readonly profileRepo: Repository<PatientProfile>,
  ) {}

  canHandle(_question: string, intent: AiIntent): boolean {
    return (
      intent === 'patient_profile_question' ||
      intent === 'medical_record_question' ||
      intent === 'mixed_question'
    );
  }

  async fetchContext(user: AiContextUser): Promise<PatientProfile | null> {
    const patientId = user.patientContextId ?? user.id;
    if (!patientId) return null;
    return this.profileRepo.findOne({ where: { user_id: patientId } });
  }

  buildContextText(data: unknown): string {
    const profile = data as PatientProfile | null;
    if (!profile) {
      return 'No patient profile found for the authenticated user.';
    }
    return `[Patient Profile]\n${buildPatientProfileText(profile)}`;
  }

  async getVersionKey(user: AiContextUser): Promise<string> {
    const patientId = user.patientContextId ?? user.id;
    const profile = patientId
      ? await this.profileRepo.findOne({
          where: { user_id: patientId },
          select: ['user_id', 'updated_at'],
        })
      : null;
    return profile
      ? `profile:${profile.user_id}:${profile.updated_at?.getTime() ?? 0}`
      : 'profile:none';
  }
}
