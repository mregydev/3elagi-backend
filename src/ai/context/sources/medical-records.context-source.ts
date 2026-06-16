import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Diagnosis } from '../../../entities/diagnosis.entity';
import { DoctorPatientAccess } from '../../../entities/doctor-patient-access.entity';
import { Doctor } from '../../../entities/doctor.entity';
import { MedicalDocument } from '../../../entities/medical-document.entity';
import { PatientProfile } from '../../../entities/patient-profile.entity';
import { Prescription } from '../../../entities/prescription.entity';
import { Symptom } from '../../../entities/symptom.entity';
import { UserRole } from '../../../entities/user.entity';
import {
  buildDiagnosisText,
  buildMedicalDocumentText,
  buildPrescriptionText,
  documentTypeLabel,
} from '../../knowledge-text.builder';
import type { AIContextSource } from '../ai-context-source.interface';
import type { AiContextUser, AiIntent } from '../ai-context.types';

interface MedicalRecordsPayload {
  diagnoses: Array<{ diagnosis: Diagnosis; symptoms: Symptom[]; patientName?: string }>;
  documents: Array<{ document: MedicalDocument; patientName?: string }>;
  prescriptions: Array<{
    prescription: Prescription;
    patientName?: string;
    doctorName?: string | null;
  }>;
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
    @InjectRepository(Prescription)
    private readonly prescriptionRepo: Repository<Prescription>,
    @InjectRepository(Doctor)
    private readonly doctorRepo: Repository<Doctor>,
    @InjectRepository(DoctorPatientAccess)
    private readonly accessRepo: Repository<DoctorPatientAccess>,
    @InjectRepository(PatientProfile)
    private readonly profileRepo: Repository<PatientProfile>,
  ) {}

  canHandle(_question: string, intent: AiIntent): boolean {
    return (
      intent === 'medical_record_question' ||
      intent === 'health_recommendation_question' ||
      intent === 'doctor_recommendation_question' ||
      intent === 'mixed_question'
    );
  }

  async fetchContext(user: AiContextUser): Promise<MedicalRecordsPayload | null> {
    if (user.role === UserRole.DOCTOR) {
      return this.fetchDoctorMedicalRecords(user);
    }

    const patientId = user.patientContextId ?? user.id;
    if (!patientId) return null;
    return this.fetchPatientMedicalRecords([patientId]);
  }

  private async fetchDoctorMedicalRecords(
    user: AiContextUser,
  ): Promise<MedicalRecordsPayload | null> {
    const doctor = await this.doctorRepo.findOne({ where: { user_id: user.id } });
    if (!doctor) return null;

    let patientIds: string[];
    if (user.patientContextId) {
      patientIds = [user.patientContextId];
    } else {
      const rows = await this.accessRepo.find({
        where: {
          doctor_id: doctor.id,
          records_allowed: true,
          blocked_by_patient: false,
          blocked_by_doctor: false,
        },
      });
      patientIds = rows.map((r) => r.patient_user_id);
    }

    if (!patientIds.length) {
      return { diagnoses: [], documents: [], prescriptions: [] };
    }

    return this.fetchPatientMedicalRecords(patientIds);
  }

  private async fetchPatientMedicalRecords(
    patientIds: string[],
  ): Promise<MedicalRecordsPayload> {
    const profiles = await this.profileRepo.find({
      where: { user_id: In(patientIds) },
    });
    const nameByUserId = new Map(profiles.map((p) => [p.user_id, p.name]));

    const [diagnoses, documents, prescriptions] = await Promise.all([
      this.diagnosisRepo.find({
        where: { patient_id: In(patientIds) },
        order: { created_at: 'DESC' },
        take: 30,
      }),
      this.docRepo.find({
        where: { patient_id: In(patientIds) },
        order: { created_at: 'DESC' },
        take: 30,
      }),
      this.prescriptionRepo.find({
        where: { patient_user_id: In(patientIds) },
        relations: ['medications', 'doctor'],
        order: { created_at: 'DESC' },
        take: 30,
      }),
    ]);

    const withSymptoms = await Promise.all(
      diagnoses.map(async (diagnosis) => ({
        diagnosis,
        symptoms: await this.symptomRepo.find({
          where: { diagnosis_id: diagnosis.id },
        }),
        patientName: nameByUserId.get(diagnosis.patient_id),
      })),
    );

    return {
      diagnoses: withSymptoms,
      documents: documents.map((document) => ({
        document,
        patientName: nameByUserId.get(document.patient_id),
      })),
      prescriptions: prescriptions.map((prescription) => ({
        prescription,
        patientName: prescription.patient_user_id
          ? nameByUserId.get(prescription.patient_user_id)
          : undefined,
        doctorName: prescription.doctor?.name ?? null,
      })),
    };
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
        if (row.patientName) {
          sections.push(`Patient: ${row.patientName}`);
        }
        sections.push(buildDiagnosisText(row.diagnosis, row.symptoms));
        sections.push(`Link: /medical/${row.diagnosis.id} | ${row.diagnosis.desc}`);
      }
    } else {
      sections.push('[Diagnoses]\nNo diagnoses recorded.');
    }

    if (payload.documents.length) {
      sections.push('\n[Medical Documents]');
      for (const row of payload.documents) {
        if (row.patientName) {
          sections.push(`Patient: ${row.patientName}`);
        }
        sections.push(
          buildMedicalDocumentText(row.document, documentTypeLabel(row.document.type)),
        );
        const title = row.document.title?.trim() || row.document.file_name || 'Medical document';
        sections.push(`Link: /medical/${row.document.id} | ${title}`);
      }
    } else {
      sections.push('\n[Medical Documents]\nNo lab results or imaging reports recorded.');
    }

    if (payload.prescriptions.length) {
      sections.push('\n[Prescriptions]');
      for (const row of payload.prescriptions) {
        if (row.patientName) {
          sections.push(`Patient: ${row.patientName}`);
        }
        sections.push(
          buildPrescriptionText(
            row.prescription,
            row.doctorName ? `Dr ${row.doctorName}` : null,
            row.patientName ?? null,
          ),
        );
        sections.push(
          `Link: /medical/${row.prescription.id} | ${row.prescription.title}`,
        );
      }
    } else {
      sections.push('\n[Prescriptions]\nNo prescriptions recorded.');
    }

    return sections.join('\n\n');
  }

  async getVersionKey(user: AiContextUser): Promise<string> {
    if (user.role === UserRole.DOCTOR) {
      const doctor = await this.doctorRepo.findOne({ where: { user_id: user.id } });
      if (!doctor) return 'records:doctor:none';
      const accessCount = await this.accessRepo.count({
        where: { doctor_id: doctor.id, records_allowed: true },
      });
      return `records:doctor:${doctor.id}:${accessCount}`;
    }

    const patientId = user.patientContextId ?? user.id;
    if (!patientId) return 'records:none';

    const [diagCount, docCount, rxCount] = await Promise.all([
      this.diagnosisRepo.count({ where: { patient_id: patientId } }),
      this.docRepo.count({ where: { patient_id: patientId } }),
      this.prescriptionRepo.count({ where: { patient_user_id: patientId } }),
    ]);
    return `records:${patientId}:${diagCount}:${docCount}:${rxCount}`;
  }
}
