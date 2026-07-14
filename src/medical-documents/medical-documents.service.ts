import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MedicalDocument, DocumentType } from '../entities/medical-document.entity';
import { Patient } from '../entities/patient.entity';
import { User, UserRole } from '../entities/user.entity';
import { Doctor } from '../entities/doctor.entity';
import { Diagnosis } from '../entities/diagnosis.entity';
import { Symptom } from '../entities/symptom.entity';
import { CreateDocumentDto } from './dto/create-document.dto';
import { CreatePatientMedicalDocumentDto } from './dto/create-patient-medical-document.dto';
import { DoctorPatientAccessService } from '../doctor-patient-access/doctor-patient-access.service';
import { PatientConsentService } from '../patients/patient-consent.service';
import { KnowledgeIndexerService } from '../ai/knowledge-indexer.service';
import { resolveApiLocale, type ApiLocale } from '../common/resolve-api-locale';
import { DiagnosisDocumentService } from '../diagnosis/diagnosis-document.service';
import { MedicalRecordImageAnalyzerService } from './medical-record-image-analyzer.service';
import { UploadsService } from '../uploads/uploads.service';
import type { MedicalAiInsight } from '../common/medical-ai-insight.types';
import type { AnalyzedMedicalRecordImage } from './medical-record-image-analyzer.service';

@Injectable()
export class MedicalDocumentsService {
  private readonly logger = new Logger(MedicalDocumentsService.name);

  constructor(
    @InjectRepository(MedicalDocument)
    private docRepo: Repository<MedicalDocument>,
    @InjectRepository(Patient)
    private patientRepo: Repository<Patient>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(Doctor)
    private doctorRepo: Repository<Doctor>,
    @InjectRepository(Diagnosis)
    private diagnosisRepo: Repository<Diagnosis>,
    @InjectRepository(Symptom)
    private symptomRepo: Repository<Symptom>,
    private doctorPatientAccessService: DoctorPatientAccessService,
    private patientConsentService: PatientConsentService,
    private knowledgeIndexer: KnowledgeIndexerService,
    private diagnosisDocuments: DiagnosisDocumentService,
    private imageAnalyzer: MedicalRecordImageAnalyzerService,
    private uploads: UploadsService,
  ) {}

  private async enrichPatientDocuments(docs: MedicalDocument[]) {
    if (!docs.length) return docs;
    const summaries = await this.diagnosisDocuments.diagnosisSummariesForDocumentIds(
      docs.map((doc) => doc.id),
    );
    return this.diagnosisDocuments.enrichDocuments(docs, summaries);
  }

  private scheduleIndexDocument(documentId: string): void {
    void this.knowledgeIndexer.indexMedicalDocument(documentId).catch(() => undefined);
  }

  private async buildInsightForDocument(
    doc: Pick<MedicalDocument, 'file_url' | 'file_name' | 'title' | 'notes' | 'type'>,
    outputLang: ApiLocale = 'en',
  ): Promise<MedicalAiInsight> {
    if (doc.file_url?.trim()) {
      try {
        const buffer = await this.uploads.getBufferFromUrl(doc.file_url);
        if (buffer?.length) {
          const mime = doc.file_name?.match(/\.png$/i)
            ? 'image/png'
            : doc.file_name?.match(/\.webp$/i)
              ? 'image/webp'
              : 'image/jpeg';
          const analyzed = await this.imageAnalyzer.analyzeImage(
            buffer.toString('base64'),
            mime,
            outputLang,
          );
          return analyzed.ai_insight;
        }
      } catch (err) {
        this.logger.warn(
          `Falling back to text-only AI insight for document "${doc.title ?? doc.type}": ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }

    return this.imageAnalyzer.analyzeFromTextContext({
      title: doc.title ?? doc.type,
      notes: doc.notes,
      recordType: doc.type,
      outputLang,
    });
  }

  private async assertDoctorUser(userId: string, userRole: string): Promise<void> {
    if (userRole !== 'doctor') {
      throw new ForbiddenException('Insufficient role');
    }
    const doctor = await this.doctorRepo.findOne({ where: { user_id: userId } });
    if (!doctor) throw new ForbiddenException('Doctor profile not found');
  }

  async findForPatientUser(
    userId: string,
    type?: DocumentType.LAB | DocumentType.XRAY,
  ) {
    const where: { patient_id: string; type?: DocumentType } = { patient_id: userId };
    if (type) where.type = type;
    const docs = await this.docRepo.find({
      where,
      order: { created_at: 'DESC' },
    });
    return this.enrichPatientDocuments(docs);
  }

  async createForPatientUser(
    userId: string,
    role: string,
    dto: CreatePatientMedicalDocumentDto,
  ) {
    let subjectUserId = userId;
    const targetPatientId = dto.patient_user_id?.trim();

    if (targetPatientId) {
      if (role !== UserRole.DOCTOR) {
        throw new ForbiddenException('Only doctors can add records for another patient');
      }
      await this.doctorPatientAccessService.assertDoctorCanPrescribeForPatient(
        userId,
        targetPatientId,
      );
      subjectUserId = targetPatientId;
    } else if (role === UserRole.DOCTOR) {
      throw new BadRequestException('patient_user_id is required when adding records as a doctor');
    } else {
      const user = await this.userRepo.findOne({ where: { id: userId } });
      if (!user || user.role !== UserRole.PATIENT) {
        throw new ForbiddenException(
          'Only patients and doctors can use this endpoint for personal records',
        );
      }
    }

    await this.doctorPatientAccessService.assertPatientUser(subjectUserId);
    await this.patientConsentService.assertMedicalRecordsStorageConsent(
      subjectUserId,
    );

    if (!dto.file_url?.trim()) {
      throw new BadRequestException('Image file is required');
    }
    const notes = dto.notes?.trim() ?? '';
    if (!notes) {
      throw new BadRequestException('Description is required');
    }
    const title = dto.title?.trim() ?? '';
    if (!title) {
      throw new BadRequestException('Title is required');
    }

    const doc = this.docRepo.create({
      patient_id: subjectUserId,
      type: dto.type,
      file_url: dto.file_url.trim(),
      file_name: dto.file_name?.trim() || 'upload.jpg',
      notes,
      title,
      body_part: dto.body_part?.trim() || null,
      ai_insight: dto.ai_insight ?? null,
    });
    let saved = await this.docRepo.save(doc);

    if (dto.generate_ai_insight && !saved.ai_insight) {
      try {
        saved.ai_insight = await this.buildInsightForDocument(
          saved,
          resolveApiLocale(dto.lang),
        );
        saved = await this.docRepo.save(saved);
      } catch (err) {
        this.logger.warn(
          `AI insight generation failed during create for document ${saved.id}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }

    this.scheduleIndexDocument(saved.id);
    return saved;
  }

  async findOneForPatientUser(id: string, userId: string) {
    const doc = await this.docRepo.findOne({ where: { id } });
    if (!doc) throw new NotFoundException('Document not found');
    if (doc.patient_id !== userId) {
      throw new ForbiddenException('You can only access your own documents');
    }
    const [enriched] = await this.enrichPatientDocuments([doc]);
    return enriched;
  }

  analyzeImageBuffer(
    buffer: Buffer,
    mimeType: string,
    outputLang: ApiLocale = 'en',
    options?: { includeInsight?: boolean },
  ): Promise<AnalyzedMedicalRecordImage> {
    return this.imageAnalyzer.analyzeImage(
      buffer.toString('base64'),
      mimeType,
      outputLang,
      options,
    );
  }

  async updateForPatientUser(
    id: string,
    userId: string,
    role: string,
    patch: { title?: string; notes?: string },
  ) {
    const doc = await this.docRepo.findOne({ where: { id } });
    if (!doc) throw new NotFoundException('Document not found');
    if (role === 'patient' && doc.patient_id !== userId) {
      throw new ForbiddenException('You can only access your own documents');
    }
    if (role === 'doctor' && doc.patient_id !== userId) {
      await this.doctorPatientAccessService.assertDoctorCanEditRecords(
        userId,
        doc.patient_id,
      );
    }
    if (patch.title !== undefined) {
      const title = patch.title.trim();
      if (!title) throw new BadRequestException('Title is required');
      doc.title = title;
    }
    if (patch.notes !== undefined) {
      const notes = patch.notes.trim();
      if (!notes) throw new BadRequestException('Description is required');
      doc.notes = notes;
    }
    const saved = await this.docRepo.save(doc);
    this.scheduleIndexDocument(saved.id);
    const [enriched] = await this.enrichPatientDocuments([saved]);
    return enriched;
  }

  async generateDetailsForDocument(
    id: string,
    userId: string,
    role: string,
    outputLang: ApiLocale = 'en',
  ) {
    const doc = await this.docRepo.findOne({ where: { id } });
    if (!doc) throw new NotFoundException('Document not found');
    if (role === 'patient' && doc.patient_id !== userId) {
      throw new ForbiddenException('You can only access your own documents');
    }
    if (role === 'doctor' && doc.patient_id !== userId) {
      await this.doctorPatientAccessService.assertDoctorCanEditRecords(
        userId,
        doc.patient_id,
      );
    }
    if (!doc.file_url?.trim()) {
      throw new BadRequestException('This record has no image to analyze');
    }
    const buffer = await this.uploads.getBufferFromUrl(doc.file_url);
    if (!buffer?.length) {
      throw new BadRequestException('Could not load the record image');
    }
    const mime = doc.file_name?.match(/\.png$/i)
      ? 'image/png'
      : doc.file_name?.match(/\.webp$/i)
        ? 'image/webp'
        : doc.file_name?.match(/\.avif$/i)
          ? 'image/avif'
          : 'image/jpeg';
    const analyzed = await this.imageAnalyzer.analyzeImage(
      buffer.toString('base64'),
      mime,
      outputLang,
      { includeInsight: false },
    );
    doc.title = analyzed.title;
    doc.notes = analyzed.notes;
    doc.type = analyzed.type;
    const saved = await this.docRepo.save(doc);
    this.scheduleIndexDocument(saved.id);
    const [enriched] = await this.enrichPatientDocuments([saved]);
    return enriched;
  }

  async generateInsightForDocument(
    id: string,
    userId: string,
    outputLang: ApiLocale = 'en',
  ) {
    const doc = await this.docRepo.findOne({ where: { id } });
    if (!doc) throw new NotFoundException('Document not found');
    if (doc.patient_id !== userId) {
      throw new ForbiddenException('You can only access your own documents');
    }

    doc.ai_insight = await this.buildInsightForDocument(doc, outputLang);
    const saved = await this.docRepo.save(doc);
    this.scheduleIndexDocument(saved.id);
    const [enriched] = await this.enrichPatientDocuments([saved]);
    return enriched;
  }

  async createFromAnalyzedImage(input: {
    userId: string;
    role: string;
    fileUrl: string;
    fileName: string;
    analyzed: AnalyzedMedicalRecordImage;
    patientUserId?: string;
    includeInsight?: boolean;
  }) {
    const dto: CreatePatientMedicalDocumentDto = {
      type: input.analyzed.type,
      file_url: input.fileUrl,
      file_name: input.fileName,
      title: input.analyzed.title,
      notes: input.analyzed.notes,
      ai_insight:
        input.includeInsight === false ? undefined : input.analyzed.ai_insight,
      patient_user_id: input.patientUserId,
    };
    return this.createForPatientUser(input.userId, input.role, dto);
  }

  async findByPatient(
    patientId: string,
    type: DocumentType | undefined,
    userId: string,
    userRole: string,
  ) {
    if (userRole === 'patient' && patientId !== userId) {
      throw new ForbiddenException('You can only access your own documents');
    }
    if (userRole === 'doctor' && patientId !== userId) {
      await this.doctorPatientAccessService.assertDoctorCanEditRecords(
        userId,
        patientId,
      );
    }
    const where: Partial<MedicalDocument> & { type?: DocumentType } = {
      patient_id: patientId,
    };
    if (type) where.type = type;
    const docs = await this.docRepo.find({ where, order: { created_at: 'DESC' } });
    return this.enrichPatientDocuments(docs);
  }

  /** `subjectUserId` is the patient user's id (stored in medical_documents.patient_id). */
  private async validateDiagnosisAndSymptomLinks(
    subjectUserId: string,
    diagnosisId?: string,
    symptomId?: string,
  ): Promise<void> {
    if (diagnosisId) {
      const diagnosis = await this.diagnosisRepo.findOne({ where: { id: diagnosisId } });
      if (!diagnosis) throw new NotFoundException('Diagnosis not found');
      if (diagnosis.patient_id !== subjectUserId) {
        throw new ForbiddenException('Diagnosis does not belong to this user');
      }
    }
    if (symptomId) {
      const symptom = await this.symptomRepo.findOne({
        where: { id: symptomId },
        relations: ['diagnosis'],
      });
      if (!symptom) throw new NotFoundException('Symptom not found');
      if (symptom.diagnosis.patient_id !== subjectUserId) {
        throw new ForbiddenException('Symptom does not belong to this user');
      }
      if (diagnosisId && symptom.diagnosis_id !== diagnosisId) {
        throw new ForbiddenException('Symptom does not belong to this diagnosis');
      }
    }
  }

  async create(dto: CreateDocumentDto, userId: string, userRole: string) {
    try {
    if (userRole === 'patient' && dto.patient_id !== userId) {
      throw new ForbiddenException('You can only upload documents for yourself');
    }
    if (dto.type === DocumentType.LAB || dto.type === DocumentType.XRAY) {
      if (!dto.file_url?.trim()) {
        throw new BadRequestException('Image file is required for lab results and X-rays');
      }
      if (!dto.title?.trim()) {
        throw new BadRequestException('Title is required for lab results and X-rays');
      }
      if (!dto.notes?.trim()) {
        throw new BadRequestException('Description is required for lab results and X-rays');
      }
    }
    this.logger.log('user id is ' + dto.patient_id);
    const user = await this.userRepo.findOne({ where: { id: dto.patient_id } });
    if (!user) throw new NotFoundException('User not found');
    if (user.role !== UserRole.PATIENT) {
      throw new ForbiddenException('Medical documents must be linked to a patient user');
    }
    if (userRole === 'doctor' && dto.patient_id !== userId) {
      await this.doctorPatientAccessService.assertDoctorCanPrescribeForPatient(
        userId,
        dto.patient_id,
      );
    }
    await this.patientConsentService.assertMedicalRecordsStorageConsent(
      dto.patient_id,
    );
    /*await this.validateDiagnosisAndSymptomLinks(
      dto.patient_id,
      dto.diagnosis_id,
      dto.symptom_id,
    );*/
      const title =
        typeof dto.title === 'string' && dto.title.trim() ? dto.title.trim() : null;
      this.logger.log(`creating document title="${title ?? ''}" for user ${dto.patient_id}`);

      const doc = this.docRepo.create({
        patient_id: dto.patient_id,
        type: dto.type,
        file_url: dto.file_url,
        file_name: dto.file_name,
        notes: dto.notes,
        title,
        body_part: dto.body_part?.trim() || null,
        symptom_id: dto.symptom_id ?? null,
      });
      const saved = await this.docRepo.save(doc);
      if (dto.diagnosis_id) {
        await this.diagnosisDocuments.linkDocuments(
          dto.diagnosis_id,
          dto.patient_id,
          [saved.id],
        );
      }
      this.scheduleIndexDocument(saved.id);
      return saved;
    } catch (error) {
      this.logger.error('Error creating medical document: ' + JSON.stringify(error));
      throw error;
    }
  }

  async deleteForPatientUser(id: string, userId: string) {
    const doc = await this.docRepo.findOne({ where: { id } });
    if (!doc) throw new NotFoundException('Document not found');
    if (doc.patient_id !== userId) {
      throw new ForbiddenException('You can only delete your own documents');
    }
    if (doc.type !== DocumentType.LAB && doc.type !== DocumentType.XRAY) {
      throw new ForbiddenException('You can only delete lab results and imaging');
    }
    await this.docRepo.delete(id);
    void this.knowledgeIndexer.deleteChunk('medical_record', id).catch(() => undefined);
    return { message: 'Document deleted' };
  }

  async delete(id: string, userId: string, userRole: string) {
    if (userRole === 'patient') {
      return this.deleteForPatientUser(id, userId);
    }
    if (userRole === 'doctor') {
      throw new ForbiddenException(
        'Doctors cannot delete patient lab results or imaging',
      );
    }
    throw new ForbiddenException('Insufficient role');
  }
}
