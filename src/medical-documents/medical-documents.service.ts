import {
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
  ) {}

  private async assertDoctorUser(userId: string, userRole: string): Promise<void> {
    if (userRole !== 'doctor') {
      throw new ForbiddenException('Insufficient role');
    }
    const doctor = await this.doctorRepo.findOne({ where: { user_id: userId } });
    if (!doctor) throw new ForbiddenException('Doctor profile not found');
  }

  async findByPatient(
    patientId: string,
    type: DocumentType | undefined,
    userId: string,
    userRole: string,
  ) {
    //await this.assertDoctorUser(userId, userRole);
    const patient = await this.patientRepo.findOne({ where: { id: patientId } });
    if (!patient) throw new NotFoundException('Patient not found');
    const where: Partial<MedicalDocument> & { type?: DocumentType } = { patient_id: patientId };
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
    this.logger.log('user id is ' + dto.patient_id);
    const user = await this.userRepo.findOne({ where: { id: dto.patient_id } });
    if (!user) throw new NotFoundException('User not found');
    if (user.role !== UserRole.PATIENT) {
      throw new ForbiddenException('Medical documents must be linked to a patient user');
    }
    /*await this.validateDiagnosisAndSymptomLinks(
      dto.patient_id,
      dto.diagnosis_id,
      dto.symptom_id,
    );*/
      const doc = this.docRepo.create(dto);
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
    await this.docRepo.delete(id);
    return { message: 'Document deleted' };
  }
}
