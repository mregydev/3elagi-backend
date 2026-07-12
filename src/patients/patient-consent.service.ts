import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PatientProfile } from '../entities/patient-profile.entity';

@Injectable()
export class PatientConsentService {
  constructor(
    @InjectRepository(PatientProfile)
    private readonly profileRepo: Repository<PatientProfile>,
  ) {}

  async assertMedicalRecordsStorageConsent(patientUserId: string): Promise<void> {
    const profile = await this.profileRepo.findOne({
      where: { user_id: patientUserId },
    });
    if (!profile?.medical_records_storage_consent) {
      throw new ForbiddenException(
        'Patient has not consented to medical records storage',
      );
    }
  }
}
