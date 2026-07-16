import { Injectable, OnModuleInit } from '@nestjs/common';
import type { AIContextSource } from './context/ai-context-source.interface';
import { DoctorPatientsContextSource } from './context/sources/doctor-patients.context-source';
import { DoctorPracticeInsightsContextSource } from './context/sources/doctor-practice-insights.context-source';
import { DoctorProfileContextSource } from './context/sources/doctor-profile.context-source';
import { DoctorsContextSource } from './context/sources/doctors.context-source';
import { GeneralKnowledgeContextSource } from './context/sources/general-knowledge.context-source';
import { MedicalRecordsContextSource } from './context/sources/medical-records.context-source';
import { PatientHealthInsightsContextSource } from './context/sources/patient-health-insights.context-source';
import { PatientProfileContextSource } from './context/sources/patient-profile.context-source';
import { AppointmentsContextSource } from './context/sources/appointments.context-source';
import { ConsultationsContextSource } from './context/sources/consultations.context-source';

/** Register context sources here — core AI logic stays unchanged when adding entities. */
@Injectable()
export class AiContextRegistryService implements OnModuleInit {
  private readonly sources: AIContextSource[] = [];

  constructor(
    doctorProfile: DoctorProfileContextSource,
    doctorPatients: DoctorPatientsContextSource,
    doctorPracticeInsights: DoctorPracticeInsightsContextSource,
    patientProfile: PatientProfileContextSource,
    patientHealthInsights: PatientHealthInsightsContextSource,
    medicalRecords: MedicalRecordsContextSource,
    doctors: DoctorsContextSource,
    generalKnowledge: GeneralKnowledgeContextSource,
    appointments: AppointmentsContextSource,
    consultations: ConsultationsContextSource,
  ) {
    this.sources = [
      doctorProfile,
      doctorPatients,
      doctorPracticeInsights,
      patientProfile,
      patientHealthInsights,
      medicalRecords,
      doctors,
      generalKnowledge,
      appointments,
      consultations,
    ];
  }

  onModuleInit(): void {
    // no-op
  }

  getSources(): AIContextSource[] {
    return [...this.sources];
  }

  getSource(name: string): AIContextSource | undefined {
    return this.sources.find((s) => s.name === name);
  }
}
