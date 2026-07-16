import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Consultation } from '../entities/consultation.entity';
import { Diagnosis } from '../entities/diagnosis.entity';
import { Doctor } from '../entities/doctor.entity';
import { DoctorSpeciality } from '../entities/doctor-speciality.entity';
import { MedicalDocument } from '../entities/medical-document.entity';
import { PatientProfile } from '../entities/patient-profile.entity';
import { Patient } from '../entities/patient.entity';
import { Prescription } from '../entities/prescription.entity';
import { Symptom } from '../entities/symptom.entity';
import { AiCacheService } from './ai-cache.service';
import { EmbeddingsService } from './embeddings.service';
import type { KnowledgeEntityType } from './types/knowledge-entity-type';
import { PLATFORM_KNOWLEDGE_SCOPE } from './types/knowledge-entity-type';
import {
  buildAllergyText,
  buildConsultationText,
  buildDiagnosisText,
  buildDoctorDirectorySummary,
  buildDoctorProfileText,
  buildMedicalDocumentText,
  buildSpecialityCatalogText,
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
export class KnowledgeIndexerService implements OnModuleInit {
  private readonly logger = new Logger(KnowledgeIndexerService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly embeddings: EmbeddingsService,
    private readonly cache: AiCacheService,
    @InjectRepository(PatientProfile)
    private readonly profileRepo: Repository<PatientProfile>,
    @InjectRepository(Doctor)
    private readonly doctorRepo: Repository<Doctor>,
    @InjectRepository(DoctorSpeciality)
    private readonly specialityRepo: Repository<DoctorSpeciality>,
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
    @InjectRepository(Consultation)
    private readonly consultationRepo: Repository<Consultation>,
  ) {}

  onModuleInit(): void {
    void this.indexDoctorDirectory().catch((err) =>
      this.logger.warn(
        `Initial doctor directory indexing failed: ${
          err instanceof Error ? err.message : String(err)
        }`,
      ),
    );
  }

  async indexDoctorDirectory(): Promise<void> {
    const [doctors, specialities] = await Promise.all([
      this.doctorRepo.find({
        where: { approval_status: 'approved' },
        relations: ['speciality'],
        order: { name: 'ASC' },
      }),
      this.specialityRepo.find({ order: { name_en: 'ASC' } }),
    ]);

    const doctorCountBySpeciality = new Map<string, number>();
    for (const doctor of doctors) {
      const key =
        doctor.speciality?.name_en ?? doctor.professional_title ?? 'General';
      doctorCountBySpeciality.set(key, (doctorCountBySpeciality.get(key) ?? 0) + 1);
    }

    await this.upsertChunk({
      entityType: 'doctor_directory',
      entityId: 'platform:summary',
      patientId: null,
      doctorId: null,
      text: buildDoctorDirectorySummary(doctors, specialities),
      metadata: {
        scope: PLATFORM_KNOWLEDGE_SCOPE,
        doctorCount: doctors.length,
      },
    });

    await this.upsertChunk({
      entityType: 'speciality_catalog',
      entityId: 'platform:all',
      patientId: null,
      doctorId: null,
      text: buildSpecialityCatalogText(specialities, doctorCountBySpeciality),
      metadata: {
        scope: PLATFORM_KNOWLEDGE_SCOPE,
        specialityCount: specialities.length,
      },
    });

    for (const doctor of doctors) {
      await this.upsertChunk({
        entityType: 'doctor_profile',
        entityId: doctor.id,
        patientId: null,
        doctorId: doctor.id,
        text: buildDoctorProfileText(doctor, doctor.speciality),
        metadata: {
          scope: PLATFORM_KNOWLEDGE_SCOPE,
          name: doctor.name,
          speciality: doctor.speciality?.name_en ?? null,
          specialityAr: doctor.speciality?.name_ar ?? null,
        },
      });
    }

    this.logger.log(
      `Indexed platform doctor directory (${doctors.length} doctors, ${specialities.length} specialities)`,
    );
    await this.cache.bumpKnowledgeBaseVersion();
  }

  async indexAdminKnowledge(
    sourceId: string,
    title: string,
    text: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    const chunks = this.chunkLongText(text);
    await this.deleteAdminKnowledge(sourceId);

    for (let idx = 0; idx < chunks.length; idx += 1) {
      await this.upsertChunk({
        entityType: 'admin_knowledge',
        entityId: `${sourceId}:${idx + 1}`,
        patientId: null,
        doctorId: null,
        text: chunks[idx],
        metadata: {
          scope: PLATFORM_KNOWLEDGE_SCOPE,
          sourceId,
          title,
          chunkIndex: idx + 1,
          chunkCount: chunks.length,
          ...(metadata ?? {}),
        },
      });
    }

    this.logger.log(
      `Indexed admin knowledge ${sourceId} into ${chunks.length} chunk(s)`,
    );
    await this.cache.bumpKnowledgeBaseVersion();
  }

  async deleteAdminKnowledge(sourceId: string): Promise<void> {
    await this.dataSource.query(
      `
      DELETE FROM ai_knowledge_chunks
      WHERE entity_type = $1
        AND (entity_id = $2 OR entity_id LIKE $3)
      `,
      ['admin_knowledge', sourceId, `${sourceId}:%`],
    );
    await this.cache.bumpKnowledgeBaseVersion();
  }

  async reindexPatient(patientUserId: string): Promise<void> {
    await this.indexPatientProfile(patientUserId);
    await this.indexPatientAllergies(patientUserId);
    await this.indexPatientDiagnoses(patientUserId);
    await this.indexPatientDocuments(patientUserId);
    await this.indexPatientPrescriptions(patientUserId);
    await this.indexPatientConsultations(patientUserId);
    await this.cache.bumpKnowledgeBaseVersion(patientUserId);
  }

  async indexConsultation(consultationId: string): Promise<void> {
    const consultation = await this.consultationRepo.findOne({
      where: { id: consultationId },
    });
    if (!consultation) {
      await this.deleteChunk('consultation_summary', consultationId);
      return;
    }

    const [profile, doctor, diagnosis] = await Promise.all([
      this.profileRepo.findOne({ where: { user_id: consultation.patient_id } }),
      this.doctorRepo.findOne({ where: { user_id: consultation.doctor_id } }),
      consultation.diagnosis_id
        ? this.diagnosisRepo.findOne({ where: { id: consultation.diagnosis_id } })
        : Promise.resolve(null),
    ]);

    await this.upsertChunk({
      entityType: 'consultation_summary',
      entityId: consultationId,
      patientId: consultation.patient_id,
      doctorId: doctor?.id ?? null,
      text: buildConsultationText(
        consultation,
        profile?.name ?? null,
        doctor?.name ? `Dr ${doctor.name}` : null,
        diagnosis?.desc ?? null,
      ),
      metadata: {
        status: consultation.status,
        diagnosisId: consultation.diagnosis_id,
      },
    });
    await this.cache.bumpKnowledgeBaseVersion(consultation.patient_id);
  }

  private async indexPatientConsultations(patientUserId: string): Promise<void> {
    const rows = await this.consultationRepo.find({
      where: { patient_id: patientUserId },
      select: ['id'],
    });
    for (const row of rows) {
      await this.indexConsultation(row.id);
    }
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
    const doctor = await this.doctorRepo.findOne({
      where: { id: doctorId },
      relations: ['speciality'],
    });
    if (!doctor) {
      await this.deleteChunk('doctor_profile', doctorId);
      void this.indexDoctorDirectory().catch(() => undefined);
      return;
    }
    if (doctor.approval_status === 'approved') {
      await this.upsertChunk({
        entityType: 'doctor_profile',
        entityId: doctorId,
        patientId: null,
        doctorId: doctorId,
        text: buildDoctorProfileText(doctor, doctor.speciality),
        metadata: {
          scope: PLATFORM_KNOWLEDGE_SCOPE,
          name: doctor.name,
          userId: doctor.user_id,
          speciality: doctor.speciality?.name_en ?? null,
        },
      });
    } else {
      await this.deleteChunk('doctor_profile', doctorId);
    }
    void this.indexDoctorDirectory().catch(() => undefined);
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
      relations: ['doctor', 'patient', 'medications'],
    });
    if (!prescription) {
      await this.deleteChunk('prescription', prescriptionId);
      return;
    }
    const patientUserId =
      prescription.patient_user_id ??
      (await this.resolveClinicPatientUserId(prescription.patient));
    let patientName = prescription.patient?.name ?? null;
    if (!patientName && prescription.patient_user_id) {
      const profile = await this.profileRepo.findOne({
        where: { user_id: prescription.patient_user_id },
      });
      patientName = profile?.name ?? null;
    }
    await this.upsertChunk({
      entityType: 'prescription',
      entityId: prescriptionId,
      patientId: patientUserId,
      doctorId: prescription.doctor_id,
      text: buildPrescriptionText(
        prescription,
        prescription.doctor ? `Dr ${prescription.doctor.name}` : null,
        patientName,
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
    const prescriptionIds = new Set<string>();

    const byUser = await this.prescriptionRepo.find({
      where: { patient_user_id: patientUserId },
      select: ['id'],
    });
    for (const rx of byUser) prescriptionIds.add(rx.id);

    const profile = await this.profileRepo.findOne({
      where: { user_id: patientUserId },
    });
    if (profile?.phone) {
      const phone = profile.phone.replace(/\s/g, '');
      const clinicPatients = await this.clinicPatientRepo
        .createQueryBuilder('p')
        .where("REPLACE(p.phone, ' ', '') = :phone", { phone })
        .getMany();
      if (clinicPatients.length) {
        const legacy = await this.prescriptionRepo.find({
          where: clinicPatients.map((p) => ({ patient_id: p.id })),
          select: ['id'],
        });
        for (const rx of legacy) prescriptionIds.add(rx.id);
      }
    }

    for (const id of prescriptionIds) {
      await this.indexPrescription(id);
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

  private chunkLongText(text: string): string[] {
    const normalized = text.replace(/\r\n/g, '\n').trim();
    if (!normalized) return [];

    const maxChars = 1800;
    const overlap = 250;
    if (normalized.length <= maxChars) return [normalized];

    const chunks: string[] = [];
    let start = 0;
    while (start < normalized.length) {
      let end = Math.min(normalized.length, start + maxChars);
      if (end < normalized.length) {
        const softBreak = Math.max(
          normalized.lastIndexOf('\n\n', end),
          normalized.lastIndexOf('. ', end),
          normalized.lastIndexOf('\n', end),
        );
        if (softBreak > start + 600) {
          end = softBreak + 1;
        }
      }
      chunks.push(normalized.slice(start, end).trim());
      if (end >= normalized.length) break;
      start = Math.max(end - overlap, start + 1);
    }
    return chunks.filter(Boolean);
  }

  private async upsertChunk(input: UpsertChunkInput): Promise<void> {
    try {
      const [embedding] = await this.embeddings.embedDocuments([input.text]);
      if (!embedding?.length) {
        this.logger.error(
          `Skipping ${input.entityType}:${input.entityId} — empty embedding`,
        );
        return;
      }
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
