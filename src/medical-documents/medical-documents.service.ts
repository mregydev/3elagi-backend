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
import { KnowledgeIndexerService } from '../ai/knowledge-indexer.service';

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
    private knowledgeIndexer: KnowledgeIndexerService,
  ) {}

  private scheduleIndexDocument(documentId: string): void {
    void this.knowledgeIndexer.indexMedicalDocument(documentId).catch(() => undefined);
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
    return this.docRepo.find({
      where,
      order: { created_at: 'DESC' },
    });
  }

  async createForPatientUser(
    userId: string,
    dto: CreatePatientMedicalDocumentDto,
  ) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (
      !user ||
      (user.role !== UserRole.PATIENT && user.role !== UserRole.DOCTOR)
    ) {
      throw new ForbiddenException(
        'Only patients and doctors can use this endpoint for personal records',
      );
    }
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
      patient_id: userId,
      type: dto.type,
      file_url: dto.file_url.trim(),
      file_name: dto.file_name?.trim() || 'upload.jpg',
      notes,
      title,
    });
    const saved = await this.docRepo.save(doc);
    this.scheduleIndexDocument(saved.id);
    return saved;
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
    return this.docRepo.find({ where, order: { created_at: 'DESC' } });
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
      await this.doctorPatientAccessService.assertDoctorCanEditRecords(
        userId,
        dto.patient_id,
      );
    }
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
        diagnosis_id: dto.diagnosis_id ?? null,
        symptom_id: dto.symptom_id ?? null,
      });
      const saved = await this.docRepo.save(doc);
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
