import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Diagnosis } from '../../../entities/diagnosis.entity';
import { MedicalDocument } from '../../../entities/medical-document.entity';
import { Symptom } from '../../../entities/symptom.entity';
import { UserRole } from '../../../entities/user.entity';
import type { AIContextSource } from '../ai-context-source.interface';
import type { AiContextUser, AiIntent } from '../ai-context.types';

interface PatientHealthInsightsPayload {
  diagnosisCount: number;
  doctorDiagnosisCount: number;
  symptomTerms: string[];
  diagnosisTerms: string[];
  documentTypes: Record<string, number>;
  recurringThemes: string[];
  latestRecordDate: string | null;
}

@Injectable()
export class PatientHealthInsightsContextSource implements AIContextSource {
  readonly name = 'patient_health_insights';

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
      intent === 'health_recommendation_question' ||
      intent === 'medical_record_question' ||
      intent === 'mixed_question'
    );
  }

  async fetchContext(user: AiContextUser): Promise<PatientHealthInsightsPayload | null> {
    if (user.role !== UserRole.PATIENT) return null;

    const patientId = user.patientContextId ?? user.id;
    if (!patientId) return null;

    const [diagnoses, documents] = await Promise.all([
      this.diagnosisRepo.find({
        where: { patient_id: patientId },
        order: { created_at: 'DESC' },
        take: 40,
      }),
      this.docRepo.find({
        where: { patient_id: patientId },
        order: { created_at: 'DESC' },
        take: 40,
      }),
    ]);

    const diagnosisIds = diagnoses.map((d) => d.id);
    const symptoms = diagnosisIds.length
      ? await this.symptomRepo.find({
          where: { diagnosis_id: In(diagnosisIds) },
        })
      : [];

    const diagnosisTerms = diagnoses
      .map((d) => d.desc.trim())
      .filter(Boolean);
    const symptomTerms = symptoms.map((s) => s.desc.trim()).filter(Boolean);

    const documentTypes: Record<string, number> = {};
    for (const doc of documents) {
      documentTypes[doc.type] = (documentTypes[doc.type] ?? 0) + 1;
    }

    const wordCounts = new Map<string, number>();
    for (const term of [...diagnosisTerms, ...symptomTerms]) {
      for (const word of term.toLowerCase().split(/\s+/)) {
        if (word.length < 4) continue;
        wordCounts.set(word, (wordCounts.get(word) ?? 0) + 1);
      }
    }
    const recurringThemes = [...wordCounts.entries()]
      .filter(([, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([word]) => word);

    const dates = [
      ...diagnoses.map((d) => d.created_at),
      ...documents.map((d) => d.created_at),
    ].filter(Boolean);
    const latest = dates.length
      ? new Date(Math.max(...dates.map((d) => d.getTime()))).toISOString().slice(0, 10)
      : null;

    return {
      diagnosisCount: diagnoses.length,
      doctorDiagnosisCount: diagnoses.filter((d) => d.doctor_id).length,
      symptomTerms: [...new Set(symptomTerms)].slice(0, 20),
      diagnosisTerms: [...new Set(diagnosisTerms)].slice(0, 15),
      documentTypes,
      recurringThemes,
      latestRecordDate: latest,
    };
  }

  buildContextText(data: unknown): string {
    const payload = data as PatientHealthInsightsPayload | null;
    if (!payload) return '';

    const lines = [
      '[Health patterns from your medical history — use these to give personalized lifestyle recommendations]',
      `Total diagnoses on record: ${payload.diagnosisCount} (${payload.doctorDiagnosisCount} confirmed by a doctor)`,
    ];

    if (payload.diagnosisTerms.length) {
      lines.push(`Diagnosis themes: ${payload.diagnosisTerms.join('; ')}`);
    }
    if (payload.symptomTerms.length) {
      lines.push(`Reported symptoms: ${payload.symptomTerms.join('; ')}`);
    }
    if (payload.recurringThemes.length) {
      lines.push(`Recurring patterns: ${payload.recurringThemes.join(', ')}`);
    }
    if (Object.keys(payload.documentTypes).length) {
      const docSummary = Object.entries(payload.documentTypes)
        .map(([type, count]) => `${type}: ${count}`)
        .join(', ');
      lines.push(`Medical documents: ${docSummary}`);
    }
    if (payload.latestRecordDate) {
      lines.push(`Most recent record date: ${payload.latestRecordDate}`);
    }

    lines.push(
      'Use these patterns to suggest things to avoid, healthy habits, and suitable foods — always tie advice to the patterns above and remind the patient to confirm with their doctor.',
    );

    return lines.join('\n');
  }

  async getVersionKey(user: AiContextUser): Promise<string> {
    if (user.role !== UserRole.PATIENT) return 'patient_insights:skip';
    const patientId = user.patientContextId ?? user.id;
    if (!patientId) return 'patient_insights:none';

    const [diagCount, docCount] = await Promise.all([
      this.diagnosisRepo.count({ where: { patient_id: patientId } }),
      this.docRepo.count({ where: { patient_id: patientId } }),
    ]);
    return `patient_insights:${patientId}:${diagCount}:${docCount}`;
  }
}
