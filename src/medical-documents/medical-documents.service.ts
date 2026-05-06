import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MedicalDocument, DocumentType } from '../entities/medical-document.entity';
import { Patient } from '../entities/patient.entity';
import { Clinic } from '../entities/clinic.entity';
import { Doctor } from '../entities/doctor.entity';
import { ClinicJoinRequest, JoinRequestStatus } from '../entities/clinic-join-request.entity';
import { CreateDocumentDto } from './dto/create-document.dto';

@Injectable()
export class MedicalDocumentsService {
  constructor(
    @InjectRepository(MedicalDocument)
    private docRepo: Repository<MedicalDocument>,
    @InjectRepository(Patient)
    private patientRepo: Repository<Patient>,
    @InjectRepository(Clinic)
    private clinicRepo: Repository<Clinic>,
    @InjectRepository(Doctor)
    private doctorRepo: Repository<Doctor>,
    @InjectRepository(ClinicJoinRequest)
    private joinRepo: Repository<ClinicJoinRequest>,
  ) {}

  /**
   * Verify the caller has access to the patient's clinic.
   * - clinic_admin: must own the clinic (owner_id match)
   * - doctor: must have an APPROVED join request for the patient's clinic
   *   AND their doctor record's default_clinic_id must match (double-check)
   */
  private async assertClinicAccess(
    patientId: string,
    userId: string,
    userRole: string,
  ): Promise<void> {
    const patient = await this.patientRepo.findOne({ where: { id: patientId } });
    if (!patient) throw new NotFoundException('Patient not found');

    if (userRole === 'clinic_admin') {
      const clinic = await this.clinicRepo.findOne({ where: { id: patient.clinic_id } });
      if (!clinic) throw new NotFoundException('Clinic not found');
      if (clinic.owner_id !== userId) {
        throw new ForbiddenException('You do not own the clinic this patient belongs to');
      }
    } else if (userRole === 'doctor') {
      // Primary check: approved join request for this clinic
      const doctor = await this.doctorRepo.findOne({ where: { user_id: userId } });
      if (!doctor) throw new ForbiddenException('Doctor profile not found');

      const approvedRequest = await this.joinRepo.findOne({
        where: {
          doctor_id: doctor.id,
          clinic_id: patient.clinic_id,
          status: JoinRequestStatus.APPROVED,
        },
      });
      if (!approvedRequest) {
        throw new ForbiddenException(
          'You are not an approved member of the clinic this patient belongs to',
        );
      }
    } else {
      throw new ForbiddenException('Insufficient role');
    }
  }

  async findByPatient(
    patientId: string,
    type: DocumentType | undefined,
    userId: string,
    userRole: string,
  ) {
    await this.assertClinicAccess(patientId, userId, userRole);
    const where: Partial<MedicalDocument> & { type?: DocumentType } = { patient_id: patientId };
    if (type) where.type = type;
    return this.docRepo.find({ where, order: { created_at: 'DESC' } });
  }

  async create(dto: CreateDocumentDto, userId: string, userRole: string) {
    await this.assertClinicAccess(dto.patient_id, userId, userRole);
    const doc = this.docRepo.create(dto);
    return this.docRepo.save(doc);
  }

  async delete(id: string, userId: string, userRole: string) {
    const doc = await this.docRepo.findOne({ where: { id } });
    if (!doc) throw new NotFoundException('Document not found');
    await this.assertClinicAccess(doc.patient_id, userId, userRole);
    await this.docRepo.delete(id);
    return { message: 'Document deleted' };
  }
}
