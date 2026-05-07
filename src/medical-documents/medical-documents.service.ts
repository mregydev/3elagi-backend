import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MedicalDocument, DocumentType } from '../entities/medical-document.entity';
import { Patient } from '../entities/patient.entity';
import { Doctor } from '../entities/doctor.entity';
import { CreateDocumentDto } from './dto/create-document.dto';

@Injectable()
export class MedicalDocumentsService {
  constructor(
    @InjectRepository(MedicalDocument)
    private docRepo: Repository<MedicalDocument>,
    @InjectRepository(Patient)
    private patientRepo: Repository<Patient>,
    @InjectRepository(Doctor)
    private doctorRepo: Repository<Doctor>,
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
    await this.assertDoctorUser(userId, userRole);
    const patient = await this.patientRepo.findOne({ where: { id: patientId } });
    if (!patient) throw new NotFoundException('Patient not found');
    const where: Partial<MedicalDocument> & { type?: DocumentType } = { patient_id: patientId };
    if (type) where.type = type;
    return this.docRepo.find({ where, order: { created_at: 'DESC' } });
  }

  async create(dto: CreateDocumentDto, userId: string, userRole: string) {
    await this.assertDoctorUser(userId, userRole);
    const patient = await this.patientRepo.findOne({ where: { id: dto.patient_id } });
    if (!patient) throw new NotFoundException('Patient not found');
    const doc = this.docRepo.create(dto);
    return this.docRepo.save(doc);
  }

  async delete(id: string, userId: string, userRole: string) {
    const doc = await this.docRepo.findOne({ where: { id } });
    if (!doc) throw new NotFoundException('Document not found');
    await this.assertDoctorUser(userId, userRole);
    await this.docRepo.delete(id);
    return { message: 'Document deleted' };
  }
}
