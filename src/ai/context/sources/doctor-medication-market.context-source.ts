import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  countryDisplayName,
  countryMedicationCatalogForPrompt,
} from '../../../common/country-medications';
import { normalizeMarketCountry } from '../../../common/patient-countries';
import { Doctor } from '../../../entities/doctor.entity';
import { UserRole } from '../../../entities/user.entity';
import { AiIntentClassifierService } from '../../ai-intent-classifier.service';
import type { AIContextSource } from '../ai-context-source.interface';
import type { AiContextUser, AiIntent } from '../ai-context.types';

type DoctorMedicationMarketData = {
  countryCode: string;
  countryName: string;
  catalog: string;
};

@Injectable()
export class DoctorMedicationMarketContextSource implements AIContextSource {
  readonly name = 'doctor_medication_market';

  constructor(
    @InjectRepository(Doctor)
    private readonly doctorRepo: Repository<Doctor>,
    private readonly intentClassifier: AiIntentClassifierService,
  ) {}

  canHandle(question: string, _intent: AiIntent): boolean {
    return this.intentClassifier.detectMedicationQuestion(question);
  }

  async fetchContext(user: AiContextUser): Promise<DoctorMedicationMarketData | null> {
    if (user.role !== UserRole.DOCTOR) return null;

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
    };
  }

  buildContextText(data: unknown): string {
    const market = data as DoctorMedicationMarketData | null;
    if (!market) return '';

    return `[Doctor practice medication market]
Practice country: ${market.countryName} (${market.countryCode})
When suggesting medication brand or trade names, prefer products commonly stocked in ${market.countryName}.
Prefer names from this ${market.countryName} market catalog when giving brand examples:
${market.catalog}
You may still discuss INN/generic names and typical doses, but local brand examples should come from this list when possible.`;
  }

  async getVersionKey(user: AiContextUser): Promise<string> {
    if (user.role !== UserRole.DOCTOR) return 'doctor_medication_market:skip';
    const doctor = await this.doctorRepo.findOne({
      where: { user_id: user.id },
      select: ['id', 'country', 'updated_at'],
    });
    return doctor
      ? `doctor_medication_market:${doctor.country}:${doctor.updated_at?.getTime() ?? 0}`
      : 'doctor_medication_market:none';
  }
}
