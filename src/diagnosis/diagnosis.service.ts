import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Diagnosis } from '../entities/diagnosis.entity';
import { Patient } from '../entities/patient.entity';
import { Doctor } from '../entities/doctor.entity';
import { Symptom } from '../entities/symptom.entity';
import { User, UserRole } from '../entities/user.entity';
import { Appointment } from '../entities/appointment.entity';
import { PatientProfile } from '../entities/patient-profile.entity';
import { CreateDiagnosisDto } from './dto/create-diagnosis.dto';
import { CreatePatientDiagnosisDto } from './dto/create-patient-diagnosis.dto';
import { UpdateDiagnosisDto } from './dto/update-diagnosis.dto';
import { MedicalDocument } from '../entities/medical-document.entity';
import { DoctorPatientAccessService } from '../doctor-patient-access/doctor-patient-access.service';
import { KnowledgeIndexerService } from '../ai/knowledge-indexer.service';
import { DiagnosisDocumentService } from './diagnosis-document.service';

type DiagnosisWithDocuments = Diagnosis & { documents?: MedicalDocument[] };

@Injectable()
export class DiagnosisService {
  constructor(
    @InjectRepository(Diagnosis) private diagnosisRepo: Repository<Diagnosis>,
    @InjectRepository(Patient) private patientRepo: Repository<Patient>,
    @InjectRepository(Doctor) private doctorRepo: Repository<Doctor>,
    @InjectRepository(Symptom) private symptomRepo: Repository<Symptom>,
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Appointment)
    private appointmentRepo: Repository<Appointment>,
    @InjectRepository(PatientProfile)
    private patientProfileRepo: Repository<PatientProfile>,
    private doctorPatientAccessService: DoctorPatientAccessService,
    private knowledgeIndexer: KnowledgeIndexerService,
    private diagnosisDocuments: DiagnosisDocumentService,
  ) {}

  private scheduleIndexDiagnosis(diagnosisId: string): void {
    void this.knowledgeIndexer.indexDiagnosis(diagnosisId).catch(() => undefined);
  }

  private normalizePhone(phone: string): string {
    return phone.replace(/\s/g, '');
  }

  private async doctorCanAccessPatientUser(
    doctorId: string,
    patientUserId: string,
  ): Promise<boolean> {
    const byUser = await this.appointmentRepo.count({
      where: { doctor_id: doctorId, patient_user_id: patientUserId },
    });
    if (byUser > 0) return true;

    const profile = await this.patientProfileRepo.findOne({
      where: { user_id: patientUserId },
    });
    if (!profile) return false;

    const phone = this.normalizePhone(profile.phone);
    const appts = await this.appointmentRepo.find({
      where: { doctor_id: doctorId },
      select: ['patient_phone'],
    });
    return appts.some(
      (a) => a.patient_phone && this.normalizePhone(a.patient_phone) === phone,
    );
  }

  private async assertDoctorUser(userId: string, userRole: string): Promise<Doctor> {
    if (userRole !== 'doctor') {
      throw new ForbiddenException('Insufficient role');
    }
    const doctor = await this.doctorRepo.findOne({ where: { user_id: userId } });
    if (!doctor) throw new ForbiddenException('Doctor profile not found');
    return doctor;
  }

  private async attachDoctorNamesToDiagnoses(rows: Diagnosis[]) {
    const doctorIds = new Set<string>();
    for (const row of rows) {
      if (row.doctor_id) doctorIds.add(row.doctor_id);
      for (const symptom of row.symptoms ?? []) {
        if (symptom.doctor_id) doctorIds.add(symptom.doctor_id);
      }
    }
    if (!doctorIds.size) return rows;

    const doctors = await this.doctorRepo.find({
      where: { id: In([...doctorIds]) },
    });
    const nameById = new Map(doctors.map((d) => [d.id, d.name]));

    for (const row of rows) {
      (row as Diagnosis & { doctor_name?: string | null }).doctor_name =
        row.doctor_id ? nameById.get(row.doctor_id) ?? null : null;
      for (const symptom of row.symptoms ?? []) {
        (symptom as Symptom & { doctor_name?: string | null }).doctor_name =
          symptom.doctor_id ? nameById.get(symptom.doctor_id) ?? null : null;
      }
    }
    return rows;
  }

  private async attachDocuments(
    rows: Diagnosis[],
  ): Promise<DiagnosisWithDocuments[]> {
    if (!rows.length) return rows;
    const byDiagnosis = await this.diagnosisDocuments.documentsForDiagnosisIds(
      rows.map((row) => row.id),
    );
    return rows.map((row) => ({
      ...row,
      documents: byDiagnosis.get(row.id) ?? [],
    }));
  }

  async findAll(patientId: string | undefined, userId: string, userRole: string) {
    await this.assertDoctorUser(userId, userRole);
    if (patientId) {
      await this.doctorPatientAccessService.assertDoctorCanEditRecords(
        userId,
        patientId,
      );
    }
    const where = patientId ? { patient_id: patientId } : {};
    const rows = await this.diagnosisRepo.find({
      where,
      order: { created_at: 'DESC' },
      relations: ['symptoms'],
    });
    const named = await this.attachDoctorNamesToDiagnoses(rows);
    return this.attachDocuments(named);
  }

  async findOne(id: string, userId: string, userRole: string) {
    await this.assertDoctorUser(userId, userRole);
    const row = await this.diagnosisRepo.findOne({
      where: { id },
      relations: ['symptoms'],
    });
    if (!row) throw new NotFoundException('Diagnosis not found');
    await this.doctorPatientAccessService.assertDoctorCanEditRecords(
      userId,
      row.patient_id,
    );
    const [enriched] = await this.attachDoctorNamesToDiagnoses([row]);
    const [withDocs] = await this.attachDocuments([enriched]);
    return withDocs;
  }

  async findForPatientUser(userId: string) {
    const rows = await this.diagnosisRepo.find({
      where: { patient_id: userId },
      order: { created_at: 'DESC' },
      relations: ['symptoms'],
    });
    const named = await this.attachDoctorNamesToDiagnoses(rows);
    return this.attachDocuments(named);
  }

  async findOneForPatientUser(id: string, userId: string) {
    const row = await this.diagnosisRepo.findOne({
      where: { id, patient_id: userId },
      relations: ['symptoms'],
    });
    if (!row) throw new NotFoundException('Diagnosis not found');
    const [enriched] = await this.attachDoctorNamesToDiagnoses([row]);
    const [withDocs] = await this.attachDocuments([enriched]);
    return withDocs;
  }

  private async saveSymptoms(
    diagnosisId: string,
    symptoms: { desc: string }[] | undefined,
    doctorId: string | null = null,
  ): Promise<void> {
    if (!symptoms?.length) return;
    const rows = symptoms
      .map((s) => s.desc.trim())
      .filter(Boolean)
      .map((desc) =>
        this.symptomRepo.create({
          desc,
          diagnosis_id: diagnosisId,
          doctor_id: doctorId,
        }),
      );
    if (rows.length) await this.symptomRepo.save(rows);
  }

  async createForPatientUser(userId: string, _dto: CreatePatientDiagnosisDto) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new ForbiddenException('User not found');
    }
    throw new ForbiddenException(
      'Only licensed doctors can add diagnoses. Please ask your doctor to record a diagnosis for you.',
    );
  }

  async addSymptomForPatientUser(
    diagnosisId: string,
    userId: string,
    desc: string,
  ) {
    throw new ForbiddenException('Patients cannot modify diagnoses');
  }

  async create(dto: CreateDiagnosisDto, userId: string, userRole: string) {
    const doctor = await this.assertDoctorUser(userId, userRole);
    const patientUser = await this.userRepo.findOne({ where: { id: dto.patient_id } });
    if (!patientUser || patientUser.role !== UserRole.PATIENT) {
      throw new NotFoundException('Patient user not found');
    }
    const targetDoctor = await this.doctorRepo.findOne({ where: { id: dto.doctor_id } });
    if (!targetDoctor) throw new NotFoundException('Doctor not found');
    if (targetDoctor.id !== doctor.id) {
      throw new ForbiddenException('You can only create diagnoses for yourself as doctor');
    }
    await this.doctorPatientAccessService.assertDoctorCanEditRecords(
      userId,
      dto.patient_id,
    );
    const { symptoms, document_ids, ...diagnosisFields } = dto;
    const row = this.diagnosisRepo.create(diagnosisFields);
    const saved = await this.diagnosisRepo.save(row);
    await this.saveSymptoms(saved.id, symptoms, doctor.id);
    await this.diagnosisDocuments.linkDocuments(
      saved.id,
      dto.patient_id,
      document_ids,
    );
    this.scheduleIndexDiagnosis(saved.id);
    return this.findOne(saved.id, userId, userRole);
  }

  async update(id: string, dto: UpdateDiagnosisDto, userId: string, userRole: string) {
    const doctor = await this.assertDoctorUser(userId, userRole);
    const row = await this.diagnosisRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Diagnosis not found');
    if (!row.doctor_id || row.doctor_id !== doctor.id) {
      throw new ForbiddenException('You can only update diagnoses you created');
    }
    await this.doctorPatientAccessService.assertDoctorCanEditRecords(
      userId,
      row.patient_id,
    );
    if (dto.patient_id) {
      const patient = await this.patientRepo.findOne({ where: { id: dto.patient_id } });
      if (!patient) throw new NotFoundException('Patient not found');
    }
    if (dto.doctor_id && dto.doctor_id !== doctor.id) {
      throw new ForbiddenException('You cannot reassign diagnosis to another doctor');
    }
    const { document_ids, ...fields } = dto;
    Object.assign(row, fields);
    const saved = await this.diagnosisRepo.save(row);
    if (document_ids?.length) {
      await this.diagnosisDocuments.linkDocuments(
        saved.id,
        row.patient_id,
        document_ids,
      );
    }
    this.scheduleIndexDiagnosis(saved.id);
    return this.findOne(saved.id, userId, userRole);
  }
}
