import { Injectable, OnModuleInit } from '@nestjs/common';
import type { AIContextSource } from './context/ai-context-source.interface';
import { DoctorPatientsContextSource } from './context/sources/doctor-patients.context-source';
import { DoctorProfileContextSource } from './context/sources/doctor-profile.context-source';
import { DoctorsContextSource } from './context/sources/doctors.context-source';
import { GeneralKnowledgeContextSource } from './context/sources/general-knowledge.context-source';
import { MedicalRecordsContextSource } from './context/sources/medical-records.context-source';
import { PatientProfileContextSource } from './context/sources/patient-profile.context-source';

/** Register context sources here — core AI logic stays unchanged when adding entities. */
@Injectable()
export class AiContextRegistryService implements OnModuleInit {
  private readonly sources: AIContextSource[] = [];

  constructor(
    doctorProfile: DoctorProfileContextSource,
    doctorPatients: DoctorPatientsContextSource,
    patientProfile: PatientProfileContextSource,
    medicalRecords: MedicalRecordsContextSource,
    doctors: DoctorsContextSource,
    generalKnowledge: GeneralKnowledgeContextSource,
  ) {
    this.sources = [
      doctorProfile,
      doctorPatients,
      patientProfile,
      medicalRecords,
      doctors,
      generalKnowledge,
    ];
  }

  onModuleInit(): void {
    // Future: appointments.context-source.ts — register here only.
  }

  getSources(): AIContextSource[] {
    return [...this.sources];
  }

  getSource(name: string): AIContextSource | undefined {
    return this.sources.find((s) => s.name === name);
  }
}
