import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  countryDisplayName,
  countryMedicationCatalogForPrompt,
} from '../../../common/country-medications';
import {
  normalizeMarketCountry,
  normalizePatientCountry,
} from '../../../common/patient-countries';
import { Doctor } from '../../../entities/doctor.entity';
import { PatientProfile } from '../../../entities/patient-profile.entity';
import { UserRole } from '../../../entities/user.entity';
import { AiIntentClassifierService } from '../../ai-intent-classifier.service';
import type { AIContextSource } from '../ai-context-source.interface';
import type { AiContextUser, AiIntent } from '../ai-context.types';

type MedicationMarketData = {
  countryCode: string;
  countryName: string;
  catalog: string;
  source: 'patient' | 'doctor';
  patientName?: string;
};

@Injectable()
export class DoctorMedicationMarketContextSource implements AIContextSource {
  readonly name = 'doctor_medication_market';

  constructor(
    @InjectRepository(Doctor)
    private readonly doctorRepo: Repository<Doctor>,
    @InjectRepository(PatientProfile)
    private readonly profileRepo: Repository<PatientProfile>,
    private readonly intentClassifier: AiIntentClassifierService,
  ) {}

  canHandle(question: string, _intent: AiIntent): boolean {
    return this.intentClassifier.detectMedicationQuestion(question);
  }

  async fetchContext(user: AiContextUser): Promise<MedicationMarketData | null> {
    if (user.role !== UserRole.DOCTOR) return null;

    if (user.patientContextId) {
      const profile = await this.profileRepo.findOne({
        where: { user_id: user.patientContextId },
        select: ['user_id', 'name', 'country', 'updated_at'],
      });
      if (profile) {
        const countryCode = normalizePatientCountry(profile.country);
        return {
          countryCode,
          countryName: countryDisplayName(countryCode, 'en'),
          catalog: countryMedicationCatalogForPrompt(countryCode),
          source: 'patient',
          patientName: profile.name,
        };
      }
    }

    const doctor = await this.doctorRepo.findOne({
      where: { user_id: user.id },
      select: ['id', 'country', 'updated_at'],
    });
    if (!doctor) return null;

    const countryCode = normalizeMarketCountry(doctor.country);
    return {
      countryCode,
      countryName: countryDisplayName(countryCode, 'en'),
      catalog: countryMedicationCatalogForPrompt(countryCode),
      source: 'doctor',
    };
  }

  buildContextText(data: unknown): string {
    const market = data as MedicationMarketData | null;
    if (!market) return '';

    if (market.source === 'patient') {
      return `[Patient medication market]
Patient: ${market.patientName ?? 'Selected patient'}
Residence country: ${market.countryName} (${market.countryCode})
When suggesting medications for this patient, prefer brand/trade names commonly stocked in ${market.countryName} (the patient's residence country).
Prefer names from this ${market.countryName} market catalog when giving brand examples:
${market.catalog}
You may still discuss INN/generic names and typical doses, but local brand examples for this patient should come from this list when possible.`;
    }

    return `[Medication market — no patient selected]
No specific patient is scoped in this chat. Using the doctor's practice country as fallback: ${market.countryName} (${market.countryCode}).
When a patient is selected, medication brands should match that patient's residence country instead.
Prefer names from this ${market.countryName} market catalog when giving brand examples:
${market.catalog}
You may still discuss INN/generic names and typical doses, but local brand examples should come from this list when possible.`;
  }

  async getVersionKey(user: AiContextUser): Promise<string> {
    if (user.role !== UserRole.DOCTOR) return 'doctor_medication_market:skip';

    if (user.patientContextId) {
      const profile = await this.profileRepo.findOne({
        where: { user_id: user.patientContextId },
        select: ['user_id', 'country', 'updated_at'],
      });
      if (profile) {
        return `doctor_medication_market:patient:${profile.user_id}:${profile.country}:${profile.updated_at?.getTime() ?? 0}`;
      }
    }

    const doctor = await this.doctorRepo.findOne({
      where: { user_id: user.id },
      select: ['id', 'country', 'updated_at'],
    });
    return doctor
      ? `doctor_medication_market:doctor:${doctor.country}:${doctor.updated_at?.getTime() ?? 0}`
      : 'doctor_medication_market:none';
  }
}
