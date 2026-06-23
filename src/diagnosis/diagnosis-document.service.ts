import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { DiagnosisDocument } from '../entities/diagnosis-document.entity';
import {
  DocumentType,
  MedicalDocument,
} from '../entities/medical-document.entity';
import { Diagnosis } from '../entities/diagnosis.entity';

export type LinkedDiagnosisSummary = { id: string; desc: string };

@Injectable()
export class DiagnosisDocumentService {
  constructor(
    @InjectRepository(DiagnosisDocument)
    private readonly linkRepo: Repository<DiagnosisDocument>,
    @InjectRepository(MedicalDocument)
    private readonly docRepo: Repository<MedicalDocument>,
    @InjectRepository(Diagnosis)
    private readonly diagnosisRepo: Repository<Diagnosis>,
  ) {}

  private async validateLinkableDocuments(
    patientUserId: string,
    documentIds: string[],
  ): Promise<void> {
    const docs = await this.docRepo.find({
      where: { id: In(documentIds), patient_id: patientUserId },
    });
    if (docs.length !== documentIds.length) {
      throw new BadRequestException(
        'One or more documents were not found for this patient',
      );
    }
    for (const doc of docs) {
      if (doc.type !== DocumentType.LAB && doc.type !== DocumentType.XRAY) {
        throw new BadRequestException(
          'Only lab results and X-rays can be linked to a diagnosis',
        );
      }
    }
  }

  async linkDocuments(
    diagnosisId: string,
    patientUserId: string,
    documentIds: string[] | undefined,
  ): Promise<void> {
    if (!documentIds?.length) return;
    const uniqueIds = [...new Set(documentIds)];
    await this.validateLinkableDocuments(patientUserId, uniqueIds);

    await this.linkRepo
      .createQueryBuilder()
      .insert()
      .into(DiagnosisDocument)
      .values(
        uniqueIds.map((medical_document_id) => ({
          diagnosis_id: diagnosisId,
          medical_document_id,
        })),
      )
      .orIgnore()
      .execute();
  }

  async documentsForDiagnosisIds(
    diagnosisIds: string[],
  ): Promise<Map<string, MedicalDocument[]>> {
    if (!diagnosisIds.length) return new Map();

    const links = await this.linkRepo.find({
      where: { diagnosis_id: In(diagnosisIds) },
      order: { created_at: 'ASC' },
    });
    if (!links.length) return new Map();

    const docIds = [...new Set(links.map((l) => l.medical_document_id))];
    const docs = await this.docRepo.find({
      where: { id: In(docIds) },
      order: { created_at: 'ASC' },
    });
    const docById = new Map(docs.map((doc) => [doc.id, doc]));

    const byDiagnosis = new Map<string, MedicalDocument[]>();
    for (const link of links) {
      const doc = docById.get(link.medical_document_id);
      if (!doc) continue;
      const list = byDiagnosis.get(link.diagnosis_id) ?? [];
      list.push(doc);
      byDiagnosis.set(link.diagnosis_id, list);
    }
    return byDiagnosis;
  }

  async diagnosisSummariesForDocumentIds(
    documentIds: string[],
  ): Promise<Map<string, LinkedDiagnosisSummary[]>> {
    if (!documentIds.length) return new Map();

    const links = await this.linkRepo.find({
      where: { medical_document_id: In(documentIds) },
      order: { created_at: 'ASC' },
    });
    if (!links.length) return new Map();

    const diagnosisIds = [...new Set(links.map((l) => l.diagnosis_id))];
    const diagnoses = await this.diagnosisRepo.find({
      where: { id: In(diagnosisIds) },
    });
    const diagnosisById = new Map(
      diagnoses.map((row) => [row.id, { id: row.id, desc: row.desc }]),
    );

    const byDocument = new Map<string, LinkedDiagnosisSummary[]>();
    for (const link of links) {
      const summary = diagnosisById.get(link.diagnosis_id);
      if (!summary) continue;
      const list = byDocument.get(link.medical_document_id) ?? [];
      if (!list.some((item) => item.id === summary.id)) {
        list.push(summary);
      }
      byDocument.set(link.medical_document_id, list);
    }
    return byDocument;
  }

  enrichDocuments<T extends MedicalDocument>(
    docs: T[],
    summariesByDocId: Map<string, LinkedDiagnosisSummary[]>,
  ): Array<T & { linked_diagnoses: LinkedDiagnosisSummary[] }> {
    return docs.map((doc) => ({
      ...doc,
      linked_diagnoses: summariesByDocId.get(doc.id) ?? [],
    }));
  }
}
