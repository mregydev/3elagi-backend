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
  ) {}

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
    return this.docRepo.save(doc);
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
      return this.docRepo.save(doc);
    } catch (error) {
      this.logger.error('Error creating medical document: ' + JSON.stringify(error));
      throw error;
    }
  }

  async delete(id: string, userId: string, userRole: string) {
    const doc = await this.docRepo.findOne({ where: { id } });
    if (!doc) throw new NotFoundException('Document not found');
    await this.assertDoctorUser(userId, userRole);
    if (userRole === 'doctor' && doc.patient_id !== userId) {
      await this.doctorPatientAccessService.assertDoctorCanEditRecords(
        userId,
        doc.patient_id,
      );
    }
    await this.docRepo.delete(id);
    return { message: 'Document deleted' };
  }
}
