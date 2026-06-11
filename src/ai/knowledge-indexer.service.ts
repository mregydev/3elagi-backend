import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Diagnosis } from '../entities/diagnosis.entity';
import { Doctor } from '../entities/doctor.entity';
import { MedicalDocument } from '../entities/medical-document.entity';
import { PatientProfile } from '../entities/patient-profile.entity';
import { Patient } from '../entities/patient.entity';
import { Prescription } from '../entities/prescription.entity';
import { Symptom } from '../entities/symptom.entity';
import { AiCacheService } from './ai-cache.service';
import { EmbeddingsService } from './embeddings.service';
import type { KnowledgeEntityType } from './types/knowledge-entity-type';
import {
  buildAllergyText,
  buildDiagnosisText,
  buildDoctorProfileText,
  buildMedicalDocumentText,
  buildPatientProfileText,
  buildPrescriptionText,
  documentTypeLabel,
  knowledgeEntityTypeForDocument,
} from './knowledge-text.builder';

interface UpsertChunkInput {
  entityType: KnowledgeEntityType;
  entityId: string;
  patientId: string | null;
  doctorId: string | null;
  text: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class KnowledgeIndexerService {
  private readonly logger = new Logger(KnowledgeIndexerService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly embeddings: EmbeddingsService,
    private readonly cache: AiCacheService,
    @InjectRepository(PatientProfile)
    private readonly profileRepo: Repository<PatientProfile>,
    @InjectRepository(Doctor)
    private readonly doctorRepo: Repository<Doctor>,
    @InjectRepository(Diagnosis)
    private readonly diagnosisRepo: Repository<Diagnosis>,
    @InjectRepository(Symptom)
    private readonly symptomRepo: Repository<Symptom>,
    @InjectRepository(MedicalDocument)
    private readonly docRepo: Repository<MedicalDocument>,
    @InjectRepository(Prescription)
    private readonly prescriptionRepo: Repository<Prescription>,
    @InjectRepository(Patient)
    private readonly clinicPatientRepo: Repository<Patient>,
  ) {}

  async reindexPatient(patientUserId: string): Promise<void> {
    await this.indexPatientProfile(patientUserId);
    await this.indexPatientAllergies(patientUserId);
    await this.indexPatientDiagnoses(patientUserId);
    await this.indexPatientDocuments(patientUserId);
    await this.indexPatientPrescriptions(patientUserId);
    await this.cache.bumpKnowledgeBaseVersion(patientUserId);
  }

  async indexPatientProfile(patientUserId: string): Promise<void> {
    const profile = await this.profileRepo.findOne({
      where: { user_id: patientUserId },
    });
    if (!profile) {
      await this.deleteChunk('patient_profile', patientUserId);
      return;
    }
    await this.upsertChunk({
      entityType: 'patient_profile',
      entityId: patientUserId,
      patientId: patientUserId,
      doctorId: null,
      text: buildPatientProfileText(profile),
      metadata: { name: profile.name },
    });
    if (profile.medical_notes?.trim()) {
      await this.upsertChunk({
        entityType: 'doctor_note',
        entityId: `${patientUserId}:medical_notes`,
        patientId: patientUserId,
        doctorId: null,
        text: `Patient: ${profile.name}\n\nNotes:\n${profile.medical_notes}`,
      });
    } else {
      await this.deleteChunk('doctor_note', `${patientUserId}:medical_notes`);
    }
  }

  async indexPatientAllergies(patientUserId: string): Promise<void> {
    const profile = await this.profileRepo.findOne({
      where: { user_id: patientUserId },
    });
    if (!profile?.allergies?.trim()) {
      await this.deleteChunk('allergy', patientUserId);
      return;
    }
    await this.upsertChunk({
      entityType: 'allergy',
      entityId: patientUserId,
      patientId: patientUserId,
      doctorId: null,
      text: buildAllergyText(profile),
    });
  }

  async indexDoctor(doctorId: string): Promise<void> {
    const doctor = await this.doctorRepo.findOne({ where: { id: doctorId } });
    if (!doctor) {
      await this.deleteChunk('doctor_profile', doctorId);
      return;
    }
    await this.upsertChunk({
      entityType: 'doctor_profile',
      entityId: doctorId,
      patientId: null,
      doctorId: doctorId,
      text: buildDoctorProfileText(doctor),
      metadata: { name: doctor.name, userId: doctor.user_id },
    });
    await this.cache.bumpKnowledgeBaseVersion();
  }

  async indexDiagnosis(diagnosisId: string): Promise<void> {
    const diagnosis = await this.diagnosisRepo.findOne({
      where: { id: diagnosisId },
      relations: ['doctor'],
    });
    if (!diagnosis) {
      await this.deleteChunk('diagnosis', diagnosisId);
      return;
    }
    const symptoms = await this.symptomRepo.find({
      where: { diagnosis_id: diagnosisId },
    });
    const doctorName = diagnosis.doctor?.name
      ? `Dr ${diagnosis.doctor.name}`
      : null;
    await this.upsertChunk({
      entityType: 'diagnosis',
      entityId: diagnosisId,
      patientId: diagnosis.patient_id,
      doctorId: diagnosis.doctor_id,
      text: buildDiagnosisText(diagnosis, symptoms, doctorName),
      metadata: { diagnosis: diagnosis.desc },
    });
    await this.cache.bumpKnowledgeBaseVersion(diagnosis.patient_id);
  }

  async indexMedicalDocument(documentId: string): Promise<void> {
    const doc = await this.docRepo.findOne({ where: { id: documentId } });
    if (!doc) {
      await this.deleteChunkByEntityPrefix(documentId);
      return;
    }
    const entityType = knowledgeEntityTypeForDocument(doc.type);
    await this.upsertChunk({
      entityType,
      entityId: documentId,
      patientId: doc.patient_id,
      doctorId: null,
      text: buildMedicalDocumentText(doc, documentTypeLabel(doc.type)),
      metadata: { type: doc.type, title: doc.title },
    });
    await this.cache.bumpKnowledgeBaseVersion(doc.patient_id);
  }

  async indexPrescription(prescriptionId: string): Promise<void> {
    const prescription = await this.prescriptionRepo.findOne({
      where: { id: prescriptionId },
      relations: ['doctor', 'patient'],
    });
    if (!prescription) {
      await this.deleteChunk('prescription', prescriptionId);
      return;
    }
    const patientUserId = await this.resolveClinicPatientUserId(
      prescription.patient,
    );
    await this.upsertChunk({
      entityType: 'prescription',
      entityId: prescriptionId,
      patientId: patientUserId,
      doctorId: prescription.doctor_id,
      text: buildPrescriptionText(
        prescription,
        prescription.doctor ? `Dr ${prescription.doctor.name}` : null,
        prescription.patient?.name ?? null,
      ),
      metadata: { title: prescription.title },
    });
    if (patientUserId) {
      await this.cache.bumpKnowledgeBaseVersion(patientUserId);
    }
  }

  async deleteChunk(
    entityType: KnowledgeEntityType,
    entityId: string,
  ): Promise<void> {
    await this.dataSource.query(
      `DELETE FROM ai_knowledge_chunks WHERE entity_type = $1 AND entity_id = $2`,
      [entityType, entityId],
    );
  }

  private async deleteChunkByEntityPrefix(_entityId: string): Promise<void> {
    // no-op placeholder for orphaned docs
  }

  private async indexPatientDiagnoses(patientUserId: string): Promise<void> {
    const diagnoses = await this.diagnosisRepo.find({
      where: { patient_id: patientUserId },
    });
    for (const d of diagnoses) {
      await this.indexDiagnosis(d.id);
    }
  }

  private async indexPatientDocuments(patientUserId: string): Promise<void> {
    const docs = await this.docRepo.find({
      where: { patient_id: patientUserId },
    });
    for (const doc of docs) {
      await this.indexMedicalDocument(doc.id);
    }
  }

  private async indexPatientPrescriptions(patientUserId: string): Promise<void> {
    const profile = await this.profileRepo.findOne({
      where: { user_id: patientUserId },
    });
    if (!profile) return;
    const phone = profile.phone.replace(/\s/g, '');
    const clinicPatients = await this.clinicPatientRepo
      .createQueryBuilder('p')
      .where("REPLACE(p.phone, ' ', '') = :phone", { phone })
      .getMany();
    if (!clinicPatients.length) return;
    const prescriptions = await this.prescriptionRepo.find({
      where: clinicPatients.map((p) => ({ patient_id: p.id })),
    });
    for (const rx of prescriptions) {
      await this.indexPrescription(rx.id);
    }
  }

  private async resolveClinicPatientUserId(
    clinicPatient?: Patient | null,
  ): Promise<string | null> {
    if (!clinicPatient?.phone) return null;
    const phone = clinicPatient.phone.replace(/\s/g, '');
    const profile = await this.profileRepo
      .createQueryBuilder('pp')
      .where("REPLACE(pp.phone, ' ', '') = :phone", { phone })
      .getOne();
    return profile?.user_id ?? null;
  }

  private async upsertChunk(input: UpsertChunkInput): Promise<void> {
    try {
      const [embedding] = await this.embeddings.embedDocuments([input.text]);
      const vectorLiteral = `[${embedding.join(',')}]`;
      await this.dataSource.query(
        `
        INSERT INTO ai_knowledge_chunks
          (entity_type, entity_id, patient_id, doctor_id, text, metadata, embedding, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::vector, NOW())
        ON CONFLICT (entity_type, entity_id)
        DO UPDATE SET
          patient_id = EXCLUDED.patient_id,
          doctor_id = EXCLUDED.doctor_id,
          text = EXCLUDED.text,
          metadata = EXCLUDED.metadata,
          embedding = EXCLUDED.embedding,
          updated_at = NOW()
        `,
        [
          input.entityType,
          input.entityId,
          input.patientId,
          input.doctorId,
          input.text,
          JSON.stringify(input.metadata ?? {}),
          vectorLiteral,
        ],
      );
    } catch (err) {
      this.logger.error(
        `Failed to index ${input.entityType}:${input.entityId}`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }
}
