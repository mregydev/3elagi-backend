import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Diagnosis } from '../../../entities/diagnosis.entity';
import { MedicalDocument } from '../../../entities/medical-document.entity';
import { Symptom } from '../../../entities/symptom.entity';
import {
  buildDiagnosisText,
  buildMedicalDocumentText,
  documentTypeLabel,
} from '../../knowledge-text.builder';
import type { AIContextSource } from '../ai-context-source.interface';
import type { AiContextUser, AiIntent } from '../ai-context.types';

interface MedicalRecordsPayload {
  diagnoses: Array<{ diagnosis: Diagnosis; symptoms: Symptom[] }>;
  documents: MedicalDocument[];
}

@Injectable()
export class MedicalRecordsContextSource implements AIContextSource {
  readonly name = 'medical_records';

  constructor(
    @InjectRepository(Diagnosis)
    private readonly diagnosisRepo: Repository<Diagnosis>,
    @InjectRepository(Symptom)
    private readonly symptomRepo: Repository<Symptom>,
    @InjectRepository(MedicalDocument)
    private readonly docRepo: Repository<MedicalDocument>,
  ) {}

  canHandle(_question: string, intent: AiIntent): boolean {
    return (
      intent === 'medical_record_question' ||
      intent === 'doctor_recommendation_question' ||
      intent === 'mixed_question'
    );
  }

  async fetchContext(user: AiContextUser): Promise<MedicalRecordsPayload | null> {
    const patientId = user.patientContextId;
    if (!patientId) return null;

    const [diagnoses, documents] = await Promise.all([
      this.diagnosisRepo.find({
        where: { patient_id: patientId },
        order: { created_at: 'DESC' },
        take: 15,
      }),
      this.docRepo.find({
        where: { patient_id: patientId },
        order: { created_at: 'DESC' },
        take: 15,
      }),
    ]);

    const withSymptoms = await Promise.all(
      diagnoses.map(async (diagnosis) => ({
        diagnosis,
        symptoms: await this.symptomRepo.find({
          where: { diagnosis_id: diagnosis.id },
        }),
      })),
    );

    return { diagnoses: withSymptoms, documents };
  }

  buildContextText(data: unknown): string {
    const payload = data as MedicalRecordsPayload | null;
    if (!payload) {
      return 'No medical records available for the authenticated patient.';
    }

    const sections: string[] = [];

    if (payload.diagnoses.length) {
      sections.push('[Diagnoses]');
      for (const row of payload.diagnoses) {
        sections.push(buildDiagnosisText(row.diagnosis, row.symptoms));
      }
    } else {
      sections.push('[Diagnoses]\nNo diagnoses recorded.');
    }

    if (payload.documents.length) {
      sections.push('\n[Medical Documents]');
      for (const doc of payload.documents) {
        sections.push(
          buildMedicalDocumentText(doc, documentTypeLabel(doc.type)),
        );
      }
    } else {
      sections.push('\n[Medical Documents]\nNo lab results or imaging reports recorded.');
    }

    return sections.join('\n\n');
  }

  async getVersionKey(user: AiContextUser): Promise<string> {
    const patientId = user.patientContextId;
    if (!patientId) return 'records:none';

    const [diagCount, docCount] = await Promise.all([
      this.diagnosisRepo.count({ where: { patient_id: patientId } }),
      this.docRepo.count({ where: { patient_id: patientId } }),
    ]);
    return `records:${patientId}:${diagCount}:${docCount}`;
  }
}
