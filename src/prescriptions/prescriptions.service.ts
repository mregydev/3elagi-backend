import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import * as PDFDocument from 'pdfkit';
import * as path from 'path';
import * as fs from 'fs';
import { Prescription, PrescriptionItem } from '../entities/prescription.entity';
import { PrescriptionMedication } from '../entities/prescription-medication.entity';
import { Doctor } from '../entities/doctor.entity';
import { resolveApiLocale, type ApiLocale } from '../common/resolve-api-locale';
import { Patient } from '../entities/patient.entity';
import { Clinic } from '../entities/clinic.entity';
import { PatientProfile } from '../entities/patient-profile.entity';
import { User, UserRole } from '../entities/user.entity';
import { MedicalDocument } from '../entities/medical-document.entity';
import { Consultation } from '../entities/consultation.entity';
import { UploadsService } from '../uploads/uploads.service';
import { KnowledgeIndexerService } from '../ai/knowledge-indexer.service';
import { DoctorPatientAccessService } from '../doctor-patient-access/doctor-patient-access.service';
import { PatientConsentService } from '../patients/patient-consent.service';
import { PointsService } from '../points/points.service';
import {
  ExtractedPrescriptionMedication,
  PrescriptionImageAnalyzerService,
} from './prescription-image-analyzer.service';
import { MedicalRecordImageAnalyzerService } from '../medical-documents/medical-record-image-analyzer.service';
import type { MedicalAiInsight } from '../common/medical-ai-insight.types';
import { UsersService } from '../users/users.service';

export type LinkedConsultationSummary = {
  id: string;
  status: Consultation['status'];
  created_at: Date;
  closed_at: Date | null;
  doctor_id: string;
  patient_id: string;
  diagnosis_id: string | null;
  doctor_name: string;
  patient_name: string;
};

interface CreatePrescriptionDto {
  patient_id: string;
  title: string;
  symptoms?: string;
  items: PrescriptionItem[];
  lang?: ApiLocale;
}

export interface PrescriptionMedicationInput {
  medication_name: string;
  interval?: string;
  dose?: string;
  notes?: string;
}

export interface CreatePrescriptionForUserDto {
  patient_user_id: string;
  title: string;
  symptoms?: string;
  medications: PrescriptionMedicationInput[];
  image_url?: string;
  body_part?: string | null;
  lang?: ApiLocale;
  diagnosis_id?: string | null;
}

const PDF_LABELS = {
  en: {
    digitalPrescription: 'Digital Prescription',
    patient: 'Patient',
    age: 'Age',
    symptoms: 'Symptoms',
    medications: 'Medications',
    noMeds: '(no medications)',
    dose: 'Dose',
    frequency: 'Frequency',
    duration: 'Duration',
    signature: 'Signature',
    dr: 'Dr.',
    ref: 'Ref',
  },
  ar: {
    digitalPrescription: 'وصفة طبية',
    patient: 'المريض',
    age: 'العمر',
    symptoms: 'الأعراض',
    medications: 'الأدوية',
    noMeds: '(لا توجد أدوية)',
    dose: 'الجرعة',
    frequency: 'التكرار',
    duration: 'المدة',
    signature: 'التوقيع',
    dr: 'د.',
    ref: 'رقم',
  },
  de: {
    digitalPrescription: 'Digitales Rezept',
    patient: 'Patient',
    age: 'Alter',
    symptoms: 'Symptome',
    medications: 'Medikamente',
    noMeds: '(keine Medikamente)',
    dose: 'Dosis',
    frequency: 'Häufigkeit',
    duration: 'Dauer',
    signature: 'Unterschrift',
    dr: 'Dr.',
    ref: 'Ref',
  },
  es: {
    digitalPrescription: 'Receta digital',
    patient: 'Paciente',
    age: 'Edad',
    symptoms: 'Síntomas',
    medications: 'Medicamentos',
    noMeds: '(sin medicamentos)',
    dose: 'Dosis',
    frequency: 'Frecuencia',
    duration: 'Duración',
    signature: 'Firma',
    dr: 'Dr.',
    ref: 'Ref',
  },
} as const;

function pdfLabelsFor(lang: ApiLocale) {
  return PDF_LABELS[lang] ?? PDF_LABELS.en;
}

const PRESCRIPTION_IMAGE_POINT_COST = 1;

function buildRefNumber(rx: { id: string; created_at?: Date | string | null }): string {
  const d = new Date(rx.created_at ?? Date.now());
  const y = d.getFullYear().toString().slice(-2);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const short = (rx.id || '').replace(/-/g, '').slice(-6).toUpperCase();
  return `RX-${y}${m}${day}-${short}`;
}

@Injectable()
export class PrescriptionsService {
  constructor(
    @InjectRepository(Prescription) private repo: Repository<Prescription>,
    @InjectRepository(PrescriptionMedication)
    private medicationRepo: Repository<PrescriptionMedication>,
    @InjectRepository(Doctor) private doctorRepo: Repository<Doctor>,
    @InjectRepository(Patient) private patientRepo: Repository<Patient>,
    @InjectRepository(Clinic) private clinicRepo: Repository<Clinic>,
    @InjectRepository(PatientProfile)
    private patientProfileRepo: Repository<PatientProfile>,
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(MedicalDocument)
    private medicalDocumentRepo: Repository<MedicalDocument>,
    @InjectRepository(Consultation)
    private consultationRepo: Repository<Consultation>,
    private uploads: UploadsService,
    private knowledgeIndexer: KnowledgeIndexerService,
    private doctorPatientAccessService: DoctorPatientAccessService,
    private patientConsentService: PatientConsentService,
    private prescriptionImageAnalyzer: PrescriptionImageAnalyzerService,
    private medicalImageAnalyzer: MedicalRecordImageAnalyzerService,
    private pointsService: PointsService,
    private users: UsersService,
  ) {}

  private normalizeMedicationInputs(
    rows: PrescriptionMedicationInput[] | undefined,
  ): PrescriptionMedicationInput[] {
    if (!Array.isArray(rows)) return [];
    return rows
      .map((row) => ({
        medication_name: row?.medication_name?.trim() ?? '',
        interval: row?.interval?.trim() || undefined,
        dose: row?.dose?.trim() || undefined,
        notes: row?.notes?.trim() || undefined,
      }))
      .filter((row) => row.medication_name.length > 0);
  }

  private medicationsToItems(
    medications: PrescriptionMedication[] | undefined,
  ): PrescriptionItem[] {
    return (medications ?? []).map((med) => ({
      name: med.medication_name,
      dose: med.dose ?? undefined,
      frequency: med.interval ?? undefined,
      notes: med.notes ?? undefined,
    }));
  }

  private resolveItems(rx: Prescription): PrescriptionItem[] {
    if (rx.medications?.length) return this.medicationsToItems(rx.medications);
    return rx.items ?? [];
  }

  private async saveMedications(
    prescriptionId: string,
    medications: PrescriptionMedicationInput[],
  ): Promise<PrescriptionMedication[]> {
    await this.medicationRepo.delete({ prescription_id: prescriptionId });
    if (!medications.length) return [];
    const rows = medications.map((med) =>
      this.medicationRepo.create({
        prescription_id: prescriptionId,
        medication_name: med.medication_name,
        interval: med.interval ?? null,
        dose: med.dose ?? null,
        notes: med.notes ?? null,
      }),
    );
    return this.medicationRepo.save(rows);
  }

  private load3elagiLogoBuffer(): Buffer | null {
    const logoPath = path.join(process.cwd(), 'assets/images/3elagi-mark.png');
    try {
      if (fs.existsSync(logoPath)) return fs.readFileSync(logoPath);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[prescriptions] load 3elagi logo failed', e);
    }
    return null;
  }

  private async renderAndStorePdf(
    saved: Prescription,
    doctor: Doctor,
    patient: { name: string; phone?: string | null; age?: number | null },
    clinic: Clinic | null,
    lang: ApiLocale,
  ): Promise<string | null> {
    const signatureBuffer = doctor.digital_signature_url
      ? await this.uploads.getBufferFromUrl(doctor.digital_signature_url)
      : null;
    const logoBuffer = this.load3elagiLogoBuffer();
    const pseudoPatient = {
      name: patient.name,
      phone: patient.phone ?? '',
      age: patient.age ?? null,
    } as Patient;
    const pdfBuffer = await this.renderPdf(
      saved,
      doctor,
      pseudoPatient,
      clinic,
      signatureBuffer,
      logoBuffer,
      lang,
    );
    const upload = await this.uploads.uploadFile({
      originalname: `prescription-${saved.id}.pdf`,
      mimetype: 'application/pdf',
      buffer: pdfBuffer,
      size: pdfBuffer.length,
    } as Express.Multer.File);
    await this.repo.update(saved.id, { pdf_url: upload.url });
    saved.pdf_url = upload.url;
    return upload.url;
  }

  /**
   * Return existing prescription PDF, or generate one (3elagi logo header +
   * doctor signature footer when available). Doctor-authored Rxs only.
   */
  async getOrGeneratePdfForPatientUser(
    id: string,
    userId: string,
    role: string,
    opts: { lang?: ApiLocale; regenerate?: boolean } = {},
  ): Promise<{ pdf_url: string }> {
    const row = await this.findOneForPatientUser(id, userId, role);
    if (row.pdf_url && !opts.regenerate) {
      return { pdf_url: row.pdf_url };
    }
    if (!row.doctor_id) {
      throw new BadRequestException(
        'PDF is only available for prescriptions issued by a doctor',
      );
    }
    const doctor = await this.doctorRepo.findOne({ where: { id: row.doctor_id } });
    if (!doctor) throw new NotFoundException('Doctor not found');

    const patientUserId = row.patient_user_id!;
    const profile = await this.patientProfileRepo.findOne({
      where: { user_id: patientUserId },
    });
    const patientUser =
      profile != null
        ? null
        : await this.userRepo.findOne({ where: { id: patientUserId } });
    const clinic = row.clinic_id
      ? await this.clinicRepo.findOne({ where: { id: row.clinic_id } })
      : null;

    const withMeds =
      (await this.repo.findOne({
        where: { id: row.id },
        relations: ['medications'],
      })) ?? row;

    const pdf_url = await this.renderAndStorePdf(
      withMeds,
      doctor,
      {
        name: profile?.name ?? patientUser?.email?.split('@')[0] ?? 'Patient',
        phone: profile?.phone ?? '',
        age: null,
      },
      clinic,
      resolveApiLocale(opts.lang),
    );
    if (!pdf_url) {
      throw new BadRequestException('Failed to generate prescription PDF');
    }
    return { pdf_url };
  }

  private async attachDoctorNames(rows: Prescription[]): Promise<
    (Prescription & { doctor_name?: string | null })[]
  > {
    if (!rows.length) return rows;
    const doctorIds = [
      ...new Set(rows.map((row) => row.doctor_id).filter(Boolean)),
    ] as string[];
    if (!doctorIds.length) return rows.map((row) => ({ ...row, doctor_name: null }));
    const doctors = await this.doctorRepo.find({ where: { id: In(doctorIds) } });
    const byId = new Map(doctors.map((doctor) => [doctor.id, doctor.name]));
    return rows.map((row) => ({
      ...row,
      doctor_name: row.doctor_id ? (byId.get(row.doctor_id) ?? null) : null,
    }));
  }

  private async attachLinkedConsultations(
    rows: (Prescription & { doctor_name?: string | null })[],
  ): Promise<
    (Prescription & {
      doctor_name?: string | null;
      linked_consultations: LinkedConsultationSummary[];
    })[]
  > {
    const diagnosisIds = [
      ...new Set(
        rows.map((row) => row.diagnosis_id).filter((id): id is string => !!id),
      ),
    ];
    if (!diagnosisIds.length) {
      return rows.map((row) => ({ ...row, linked_consultations: [] }));
    }

    const consultations = await this.consultationRepo.find({
      where: { diagnosis_id: In(diagnosisIds) },
      order: { created_at: 'DESC' },
    });
    if (!consultations.length) {
      return rows.map((row) => ({ ...row, linked_consultations: [] }));
    }

    const userIds = new Set<string>();
    for (const consult of consultations) {
      userIds.add(consult.doctor_id);
      userIds.add(consult.patient_id);
    }
    const nameEntries = await Promise.all(
      [...userIds].map(
        async (userId) => [userId, await this.users.getDisplayName(userId)] as const,
      ),
    );
    const nameByUserId = new Map(nameEntries);

    const byDiagnosis = new Map<string, LinkedConsultationSummary[]>();
    for (const consult of consultations) {
      if (!consult.diagnosis_id) continue;
      const summary: LinkedConsultationSummary = {
        id: consult.id,
        status: consult.status,
        created_at: consult.created_at,
        closed_at: consult.closed_at,
        doctor_id: consult.doctor_id,
        patient_id: consult.patient_id,
        diagnosis_id: consult.diagnosis_id,
        doctor_name: nameByUserId.get(consult.doctor_id) ?? 'Doctor',
        patient_name: nameByUserId.get(consult.patient_id) ?? 'Patient',
      };
      const list = byDiagnosis.get(consult.diagnosis_id) ?? [];
      list.push(summary);
      byDiagnosis.set(consult.diagnosis_id, list);
    }

    return rows.map((row) => ({
      ...row,
      linked_consultations: row.diagnosis_id
        ? (byDiagnosis.get(row.diagnosis_id) ?? [])
        : [],
    }));
  }

  private async enrichForPatientUser(rows: Prescription[]) {
    const withNames = await this.attachDoctorNames(rows);
    return this.attachLinkedConsultations(withNames);
  }

  private async getDoctor(userId: string): Promise<Doctor> {
    const doctor = await this.doctorRepo.findOne({ where: { user_id: userId } });
    if (!doctor) throw new ForbiddenException('Doctor profile not found');
    return doctor;
  }

  async listForPatient(patientId: string, userId: string, role: string) {
    // Prefer clinic patients.id; if missing, treat id as registered users.id
    // (mobile always uses users.id).
    const clinicPatient = await this.patientRepo.findOne({ where: { id: patientId } });
    if (clinicPatient) {
      if (role === 'doctor') {
        const doctor = await this.getDoctor(userId);
        if (doctor.default_clinic_id !== clinicPatient.clinic_id) {
          return this.repo.find({
            where: { patient_id: patientId, doctor_id: doctor.id },
            order: { created_at: 'DESC' },
          });
        }
      }
      return this.repo.find({
        where: { patient_id: patientId },
        order: { created_at: 'DESC' },
      });
    }

    return this.listForPatientUser(patientId, userId, role);
  }

  async searchDiseases(q: string, userId: string): Promise<string[]> {
    const doctor = await this.getDoctor(userId);
    const term = (q || '').trim();
    const qb = this.repo
      .createQueryBuilder('p')
      .select('p.title', 'title')
      .addSelect('MAX(p.created_at)', 'last')
      .where('p.doctor_id = :did', { did: doctor.id });
    if (term) qb.andWhere('LOWER(p.title) LIKE :t', { t: `%${term.toLowerCase()}%` });
    const rows = await qb.groupBy('p.title').orderBy('last', 'DESC').limit(8).getRawMany();
    return rows.map((r) => r.title as string).filter(Boolean);
  }

  async getTemplate(title: string, userId: string): Promise<{ items: PrescriptionItem[]; symptoms: string | null } | null> {
    if (!title?.trim()) return null;
    const doctor = await this.getDoctor(userId);
    const last = await this.repo.findOne({
      where: { doctor_id: doctor.id, title: title.trim() },
      order: { created_at: 'DESC' },
    });
    if (!last) return null;
    const withMeds = await this.repo.findOne({
      where: { id: last.id },
      relations: ['medications'],
    });
    const items = withMeds?.medications?.length
      ? this.medicationsToItems(withMeds.medications)
      : last.items ?? [];
    return { items, symptoms: last.symptoms ?? null };
  }

  private async getDoctorPrescriptionReadAccess(
    doctorUserId: string,
    patientUserId: string,
  ): Promise<{ doctor: Doctor; recordsAllowed: boolean }> {
    const doctor = await this.getDoctor(doctorUserId);
    const row = await this.doctorPatientAccessService.findOrCreate(
      patientUserId,
      doctor.id,
    );
    if (row.blocked_by_patient || row.blocked_by_doctor) {
      throw new ForbiddenException('Chat is blocked between these users');
    }
    return { doctor, recordsAllowed: row.records_allowed };
  }

  async listForPatientUser(patientUserId: string, userId: string, role: string) {
    let where: { patient_user_id: string; doctor_id?: string } = {
      patient_user_id: patientUserId,
    };

    if (role === UserRole.DOCTOR) {
      const { doctor, recordsAllowed } = await this.getDoctorPrescriptionReadAccess(
        userId,
        patientUserId,
      );
      if (!recordsAllowed) {
        where = { patient_user_id: patientUserId, doctor_id: doctor.id };
      }
    } else if (role === UserRole.PATIENT) {
      if (patientUserId !== userId) {
        throw new ForbiddenException('You can only view your own prescriptions');
      }
    } else {
      throw new ForbiddenException('Insufficient role');
    }

    const rows = await this.repo.find({
      where,
      relations: ['medications'],
      order: { created_at: 'DESC' },
    });
    return this.enrichForPatientUser(rows);
  }

  async findOneForPatientUser(id: string, userId: string, role: string) {
    const row = await this.repo.findOne({
      where: { id },
      relations: ['medications'],
    });
    if (!row || !row.patient_user_id) {
      throw new NotFoundException('Prescription not found');
    }

    if (role === UserRole.DOCTOR) {
      const { doctor, recordsAllowed } = await this.getDoctorPrescriptionReadAccess(
        userId,
        row.patient_user_id,
      );
      if (!recordsAllowed && row.doctor_id !== doctor.id) {
        throw new ForbiddenException(
          'Patient has not granted permission to access medical records',
        );
      }
    } else if (role === UserRole.PATIENT) {
      if (row.patient_user_id !== userId) {
        throw new ForbiddenException('You can only view your own prescriptions');
      }
    } else {
      throw new ForbiddenException('Insufficient role');
    }

    const [enriched] = await this.enrichForPatientUser([row]);
    return enriched;
  }

  async generateInsightForPatientUser(
    id: string,
    userId: string,
    role: string,
    outputLang: ApiLocale = 'en',
  ) {
    const row = await this.findOneForPatientUser(id, userId, role);
    let insight: MedicalAiInsight | null = null;

    if (row.image_url?.trim()) {
      const buffer = await this.uploads.getBufferFromUrl(row.image_url);
      if (buffer?.length) {
        const analyzed = await this.medicalImageAnalyzer.analyzeImage(
          buffer.toString('base64'),
          'image/jpeg',
          outputLang,
        );
        insight = analyzed.ai_insight;
      }
    }

    if (!insight) {
      const medLines = (row.medications ?? [])
        .map((m) => m.medication_name)
        .join(', ');
      insight = await this.medicalImageAnalyzer.analyzeFromTextContext({
        title: row.title,
        notes: [row.symptoms, medLines].filter(Boolean).join(' — ') || null,
        recordType: 'Prescription',
        outputLang,
      });
    }

    row.ai_insight = insight;
    await this.repo.save(row);
    void this.knowledgeIndexer.indexPrescription(row.id).catch(() => undefined);
    return this.findOneForPatientUser(id, userId, role);
  }

  async analyzeImageBuffer(
    userId: string,
    buffer: Buffer,
    mimeType: string,
    outputLang: ApiLocale = 'en',
  ) {
    await this.pointsService.deductForMessage(
      userId,
      PRESCRIPTION_IMAGE_POINT_COST,
      'operation',
    );
    return this.prescriptionImageAnalyzer.extractMedications(
      buffer.toString('base64'),
      mimeType,
      outputLang,
    );
  }

  async analyzeImage(
    userId: string,
    imageBase64: string,
    mimeType: string,
    outputLang: ApiLocale = 'en',
  ): Promise<ExtractedPrescriptionMedication[]> {
    await this.pointsService.deductForMessage(
      userId,
      PRESCRIPTION_IMAGE_POINT_COST,
      'operation',
    );
    return this.prescriptionImageAnalyzer.extractMedications(
      imageBase64,
      mimeType,
      outputLang,
    );
  }

  /**
   * Optional AI draft for doctors — Egypt-listed meds only. Never auto-saves;
   * the doctor must review and create the prescription explicitly.
   */
  async draftAiPrescriptionForDiagnosis(
    input: {
      patient_user_id: string;
      diagnosis_title: string;
      consultation_id?: string;
      symptoms?: string[];
      lang?: ApiLocale;
    },
    doctorUserId: string,
    role: string,
  ) {
    if (role !== UserRole.DOCTOR) {
      throw new ForbiddenException('Only doctors can draft prescriptions with AI');
    }
    const patientUserId = input.patient_user_id?.trim();
    const title = input.diagnosis_title?.trim();
    if (!patientUserId) throw new BadRequestException('patient_user_id is required');
    if (!title) throw new BadRequestException('diagnosis_title is required');

    await this.doctorPatientAccessService.assertDoctorCanPrescribeForPatient(
      doctorUserId,
      patientUserId,
    );

    const profile = await this.patientProfileRepo.findOne({
      where: { user_id: patientUserId },
    });
    const docs = await this.medicalDocumentRepo.find({
      where: { patient_id: patientUserId },
      order: { created_at: 'DESC' },
      take: 8,
    });
    const patientLines: string[] = [];
    if (profile?.chronic_conditions?.trim()) {
      patientLines.push(`Chronic conditions: ${profile.chronic_conditions.trim()}`);
    }
    if (profile?.allergies?.trim()) {
      patientLines.push(`Allergies: ${profile.allergies.trim()}`);
    }
    if (profile?.medical_notes?.trim()) {
      patientLines.push(`Medical notes: ${profile.medical_notes.trim()}`);
    }
    for (const doc of docs) {
      patientLines.push(
        `${doc.type}: ${doc.title || doc.type}${doc.notes?.trim() ? ` — ${doc.notes.trim()}` : ''}`,
      );
    }

    let consultationContext = '';
    const consultId = input.consultation_id?.trim();
    if (consultId) {
      const consult = await this.consultationRepo.findOne({ where: { id: consultId } });
      if (consult && consult.patient_id === patientUserId) {
        consultationContext = [
          `Status: ${consult.status}`,
          consult.description?.trim()
            ? `Patient reason: ${consult.description.trim()}`
            : null,
          consult.doctor_note?.trim()
            ? `Doctor note: ${consult.doctor_note.trim()}`
            : null,
          `Started: ${consult.created_at?.toISOString?.() ?? ''}`,
        ]
          .filter(Boolean)
          .join('\n');
      }
    } else {
      const latest = await this.consultationRepo.findOne({
        where: { patient_id: patientUserId, doctor_id: doctorUserId },
        order: { created_at: 'DESC' },
      });
      if (latest) {
        consultationContext = [
          `Status: ${latest.status}`,
          latest.description?.trim()
            ? `Patient reason: ${latest.description.trim()}`
            : null,
          latest.doctor_note?.trim()
            ? `Doctor note: ${latest.doctor_note.trim()}`
            : null,
          `Started: ${latest.created_at?.toISOString?.() ?? ''}`,
        ]
          .filter(Boolean)
          .join('\n');
      }
    }

    return this.prescriptionImageAnalyzer.draftCountryPrescription({
      diagnosisTitle: title,
      patientContext: patientLines.join('\n'),
      consultationContext,
      symptoms: input.symptoms,
      patientCountry: profile?.country ?? 'EG',
      outputLang: resolveApiLocale(input.lang),
    });
  }

  async createForPatientUser(
    dto: CreatePrescriptionForUserDto,
    userId: string,
    role: string,
  ): Promise<Prescription> {
    const patientUserId = dto.patient_user_id?.trim();
    if (!patientUserId) throw new BadRequestException('patient_user_id is required');
    if (!dto.title?.trim()) throw new BadRequestException('title is required');

    const medications = this.normalizeMedicationInputs(dto.medications);
    if (!medications.length) {
      throw new BadRequestException('At least one medication is required');
    }

    let doctor: Doctor | null = null;
    if (role === UserRole.DOCTOR) {
      doctor = await this.doctorPatientAccessService.assertDoctorCanPrescribeForPatient(
        userId,
        patientUserId,
      );
    } else if (role === UserRole.PATIENT) {
      if (patientUserId !== userId) {
        throw new ForbiddenException('You can only add prescriptions to your own record');
      }
    } else {
      throw new ForbiddenException('Insufficient role');
    }

    await this.patientConsentService.assertMedicalRecordsStorageConsent(
      patientUserId,
    );

    const profile = await this.patientProfileRepo.findOne({
      where: { user_id: patientUserId },
    });
    const patientUser =
      profile != null
        ? null
        : await this.doctorPatientAccessService.assertPatientUser(patientUserId);
    const patientDisplayName =
      profile?.name ?? patientUser?.email?.split('@')[0] ?? 'Patient';
    const patientPhone = profile?.phone ?? '';

    const imageUrl = dto.image_url?.trim() || null;

    const prescription = this.repo.create({
      doctor_id: doctor?.id ?? null,
      patient_id: null,
      patient_user_id: patientUserId,
      clinic_id: doctor?.default_clinic_id ?? null,
      title: dto.title.trim(),
      symptoms: dto.symptoms?.trim() || null,
      image_url: imageUrl,
      body_part: dto.body_part?.trim() || null,
      diagnosis_id: dto.diagnosis_id?.trim() || null,
      items: medications.map((med) => ({
        name: med.medication_name,
        dose: med.dose,
        frequency: med.interval,
        notes: med.notes,
      })),
    });

    const saved = await this.repo.save(prescription);
    saved.medications = await this.saveMedications(saved.id, medications);
    void this.knowledgeIndexer.indexPrescription(saved.id).catch(() => undefined);

    if (doctor) {
      try {
        const clinic = saved.clinic_id
          ? await this.clinicRepo.findOne({ where: { id: saved.clinic_id } })
          : null;
        await this.renderAndStorePdf(
          saved,
          doctor,
          {
            name: patientDisplayName,
            phone: patientPhone,
            age: null,
          },
          clinic,
          resolveApiLocale(dto.lang),
        );
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[prescriptions] PDF generation failed', err);
      }
    }

    return saved;
  }

  async create(dto: CreatePrescriptionDto, userId: string): Promise<Prescription> {
    const doctor = await this.getDoctor(userId);
    const patient = await this.patientRepo.findOne({ where: { id: dto.patient_id } });
    // Mobile may send users.id; prefer patient-user create path instead of failing.
    if (!patient) {
      const items = Array.isArray(dto.items)
        ? dto.items.filter((i) => i && i.name?.trim())
        : [];
      return this.createForPatientUser(
        {
          patient_user_id: dto.patient_id,
          title: dto.title,
          symptoms: dto.symptoms,
          medications: items.map((i) => ({
            medication_name: i.name,
            dose: i.dose,
            interval: i.frequency,
            notes: i.notes,
          })),
          body_part: null,
        },
        userId,
        UserRole.DOCTOR,
      );
    }

    // Authorization: the doctor must be allowed to write for this patient.
    // Allow when (a) patient belongs to the doctor's default clinic, or
    // (b) the doctor has previously written a prescription for this patient.
    const sameClinic =
      !!doctor.default_clinic_id && doctor.default_clinic_id === patient.clinic_id;
    if (!sameClinic) {
      const prior = await this.repo.count({
        where: { doctor_id: doctor.id, patient_id: dto.patient_id },
      });
      if (prior === 0) {
        throw new ForbiddenException('You do not have access to this patient');
      }
    }

    const items = Array.isArray(dto.items)
      ? dto.items.filter((i) => i && i.name?.trim())
      : [];

    const prescription = this.repo.create({
      doctor_id: doctor.id,
      patient_id: dto.patient_id,
      clinic_id: patient.clinic_id ?? doctor.default_clinic_id ?? null,
      title: dto.title.trim(),
      symptoms: dto.symptoms?.trim() || null,
      items,
    });

    const saved = await this.repo.save(prescription);
    saved.medications = await this.saveMedications(
      saved.id,
      items.map((item) => ({
        medication_name: item.name,
        dose: item.dose,
        interval: item.frequency,
        notes: item.notes,
      })),
    );
    void this.knowledgeIndexer.indexPrescription(saved.id).catch(() => undefined);

    // Generate PDF and upload
    try {
      const clinic = saved.clinic_id
        ? await this.clinicRepo.findOne({ where: { id: saved.clinic_id } })
        : null;
      await this.renderAndStorePdf(
        saved,
        doctor,
        {
          name: patient.name,
          phone: patient.phone,
          age: patient.age,
        },
        clinic,
        resolveApiLocale(dto.lang),
      );
    } catch (err) {
      // PDF gen failure should not break creation; just log
      // eslint-disable-next-line no-console
      console.error('[prescriptions] PDF generation failed', err);
    }

    return saved;
  }

  private async renderPdf(
    rx: Prescription,
    doctor: Doctor,
    patient: Patient,
    clinic: Clinic | null,
    signatureBuffer: Buffer | null = null,
    logoBuffer: Buffer | null = null,
    lang: ApiLocale = 'en',
  ): Promise<Buffer> {
    const refNo = buildRefNumber(rx);

    return new Promise((resolve, reject) => {
      try {
        // margin: 0 so edge-to-edge header/footer never trip PDFKit's
        // bottom-margin page-break (which was creating trailing blank pages).
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const doc: any = new (PDFDocument as any)({
          size: 'A4',
          margin: 0,
          autoFirstPage: true,
        });
        const chunks: Buffer[] = [];
        doc.on('data', (c: Buffer) => chunks.push(c));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        const PRIMARY = '#3057F2';
        const L = pdfLabelsFor(lang);
        const isAr = lang === 'ar';
        const pageWidth = doc.page.width;
        const pageHeight = doc.page.height;
        const contentMargin = 50;
        const innerWidth = pageWidth - contentMargin * 2;

        // Always register Arabic font when present so Arabic glyphs render
        // correctly even when the prescription language is English (e.g. an
        // Arabic patient name on an English prescription).
        const arFontPath = path.join(process.cwd(), 'assets/fonts/NotoSansArabic-Regular.ttf');
        let arFontLoaded = false;
        if (fs.existsSync(arFontPath)) {
          try {
            doc.registerFont('AR', arFontPath);
            arFontLoaded = true;
          } catch (e) {
            // eslint-disable-next-line no-console
            console.error('[prescriptions] register Arabic font failed', e);
          }
        }

        const ARABIC_RE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
        const hasArabic = (s: string) => ARABIC_RE.test(s ?? '');

        // Pick a font appropriate for the actual string content. Mixed strings
        // with any Arabic codepoint use the Arabic font (Noto Sans Arabic also
        // covers Latin), while pure-Latin strings stay on Helvetica.
        const setFontFor = (s: string, size: number) => {
          if (arFontLoaded && (isAr || hasArabic(s))) doc.font('AR');
          else doc.font('Helvetica');
          doc.fontSize(size);
        };

        // RTL-aware text writer. Default alignment matches the language: AR
        // strings are right-aligned, EN strings are left-aligned, unless an
        // explicit `align` is provided.
        const write = (
          text: string,
          x: number,
          y: number,
          size: number,
          color: string,
          opts: Record<string, unknown> = {},
        ) => {
          setFontFor(text, size);
          doc.fillColor(color);
          const useArShape = isAr || hasArabic(text);
          const baseAlign: 'left' | 'right' = useArShape ? 'right' : 'left';
          const finalOpts: Record<string, unknown> = {
            align: baseAlign,
            width: innerWidth,
            ...opts,
          };
          if (useArShape) {
            finalOpts.features = ['rlig', 'init', 'medi', 'fina', 'isol'];
          }
          doc.text(text, x, y, finalOpts);
        };

        // Header band
        const headerH = 100;
        doc.rect(0, 0, pageWidth, headerH).fill(PRIMARY);

        // 3elagi logo (right in EN, left in AR — opposite the doctor name)
        const logoSize = 56;
        const logoY = (headerH - logoSize) / 2;
        const logoX = isAr ? 30 : pageWidth - 30 - logoSize;
        if (logoBuffer) {
          try {
            // Soft white circle behind logo for visibility on blue header
            doc.save();
            doc.circle(logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2 + 2).fill('#ffffff');
            doc.restore();
            doc.image(logoBuffer, logoX, logoY, {
              fit: [logoSize, logoSize],
              align: 'center',
              valign: 'center',
            });
          } catch (e) {
            // eslint-disable-next-line no-console
            console.error('[prescriptions] embed logo failed', e);
          }
        } else {
          // Fallback wordmark when asset is missing
          write('3elagi', logoX, logoY + 18, 14, '#ffffff', {
            width: logoSize + 40,
            align: isAr ? 'left' : 'right',
            lineBreak: false,
          });
        }

        // Doctor name + tagline (opposite side from logo)
        const nameBlockX = isAr ? pageWidth - 50 - innerWidth : 50;
        write(`${L.dr} ${doctor.name}`, nameBlockX, 28, 22, '#ffffff', {
          align: isAr ? 'right' : 'left',
          width: innerWidth,
        });
        write(L.digitalPrescription, nameBlockX, 62, 10, '#ffffff', {
          align: isAr ? 'right' : 'left',
          width: innerWidth,
        });

        // Clinic name + location written on the same side as the logo,
        // offset so they don't overlap the logo image
        const clinicTextWidth = innerWidth - (logoSize + 16);
        const clinicTextX = isAr ? logoX + logoSize + 16 : 50;
        const clinicName = clinic?.name ?? doctor.personal_clinic_location ?? '';
        const clinicLoc = clinic?.location ?? doctor.personal_clinic_location ?? '';
        if (clinicName) {
          write(clinicName, clinicTextX, 30, 10, '#ffffff', {
            align: isAr ? 'left' : 'right',
            width: clinicTextWidth,
          });
        }
        if (clinicLoc) {
          write(clinicLoc, clinicTextX, 48, 9, '#ffffff', {
            align: isAr ? 'left' : 'right',
            width: clinicTextWidth,
          });
        }
        // Reference number always shown below clinic info
        write(`${L.ref}: ${refNo}`, clinicTextX, 70, 8, '#ffffff', {
          align: isAr ? 'left' : 'right',
          width: clinicTextWidth,
        });

        let y = 130;

        // Doctor and patient blocks. In AR layout the doctor sits on the
        // right and the patient on the left; in EN it's the reverse.
        const blockWidth = 240;
        const doctorX = isAr ? pageWidth - 50 - blockWidth : 50;
        const patientX = isAr ? 50 : pageWidth - 50 - blockWidth;
        const blockOpts = { width: blockWidth, align: (isAr ? 'right' : 'left') as 'right' | 'left' };

        write(`${L.dr} ${doctor.name}`, doctorX, y, 14, '#0f172a', blockOpts);
        if (doctor.phone) {
          write(doctor.phone, doctorX, y + 22, 9, '#64748b', blockOpts);
        }

        write(`${L.patient}: ${patient.name}`, patientX, y, 11, '#0f172a', blockOpts);
        if (patient.phone) {
          write(patient.phone, patientX, y + 18, 9, '#64748b', blockOpts);
        }
        if (patient.age) {
          write(`${L.age}: ${patient.age}`, patientX, y + 32, 9, '#64748b', blockOpts);
        }

        y += 60;
        doc.moveTo(50, y).lineTo(pageWidth - 50, y).strokeColor('#e2e8f0').stroke();
        y += 20;

        // Title (disease)
        write(rx.title, 50, y, 16, PRIMARY);
        y = doc.y + 6;

        // Date
        write(
          new Date(rx.created_at ?? Date.now()).toLocaleDateString(isAr ? 'ar-EG' : 'en-GB'),
          50,
          y,
          9,
          '#64748b',
          { align: isAr ? 'right' : 'left' },
        );
        y = doc.y + 14;

        // Symptoms
        if (rx.symptoms) {
          write(L.symptoms, 50, y, 10, '#475569');
          y = doc.y + 4;
          write(rx.symptoms, 50, y, 11, '#0f172a');
          y = doc.y + 16;
        }

        // Medications header (replaces Rx)
        write(L.medications, 50, y, 16, PRIMARY);
        y = doc.y + 10;

        const items = this.resolveItems(rx);
        if (items.length === 0) {
          write(L.noMeds, 60, y, 11, '#94a3b8', { width: pageWidth - 120 });
          y = doc.y + 8;
        } else {
          const badgeR = 9;
          const badgeGap = 10;
          items.forEach((it, idx) => {
            const num = idx + 1;
            const metaParts: string[] = [];
            if (it.dose) metaParts.push(`${L.dose}: ${it.dose}`);
            if (it.frequency) metaParts.push(`${L.frequency}: ${it.frequency}`);
            if (it.duration) metaParts.push(`${L.duration}: ${it.duration}`);

            // Numbered circular badge
            const badgeCx = isAr ? pageWidth - 50 - badgeR : 50 + badgeR;
            const badgeCy = y + badgeR + 2;
            doc.save();
            doc.circle(badgeCx, badgeCy, badgeR).fill(PRIMARY);
            doc.restore();
            doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(10);
            doc.text(String(num), badgeCx - badgeR, badgeCy - 5, {
              width: badgeR * 2,
              align: 'center',
              lineBreak: false,
            });

            // Text column starts after the badge, with gap
            const textX = isAr ? 50 : 50 + badgeR * 2 + badgeGap;
            const textWidth = pageWidth - 100 - (badgeR * 2 + badgeGap);
            const lineAlign: 'right' | 'left' = isAr ? 'right' : 'left';

            write(it.name || '', textX, y, 12, '#0f172a', {
              width: textWidth,
              align: lineAlign,
            });
            if (metaParts.length) {
              write(metaParts.join('  •  '), textX, doc.y + 1, 10, '#475569', {
                width: textWidth,
                align: lineAlign,
              });
            }
            if (it.notes) {
              write(it.notes, textX, doc.y + 1, 9, '#94a3b8', {
                width: textWidth,
                align: lineAlign,
              });
            }
            y = doc.y + 14;
          });
        }

        // Signature + contact on the content page (never add a page only for footer).
        const contactParts: string[] = [];
        if (clinic?.phone) contactParts.push(clinic.phone);
        if (clinic?.location) contactParts.push(clinic.location);
        const contactH = contactParts.length ? 36 : 0;
        const footerBlockH = 96;
        const pageBottom = pageHeight - contactH - 12;
        const contentEndY = Math.max(doc.y, y);
        let sigY = contentEndY + 28;
        const bottomAnchoredY = pageBottom - footerBlockH;
        if (contentEndY + 28 + footerBlockH <= pageBottom) {
          // Short prescription: keep signature near the bottom of this page.
          sigY = Math.max(sigY, bottomAnchoredY);
        } else {
          // Keep signature immediately after content; do not add a blank page.
          sigY = contentEndY + 20;
        }

        doc.moveTo(50, sigY).lineTo(pageWidth - 50, sigY).strokeColor('#e2e8f0').stroke();

        const sigBlockWidth = 180;
        const sigX = isAr ? 50 : pageWidth - 50 - sigBlockWidth;
        const sigAlign: 'right' | 'left' = isAr ? 'right' : 'left';
        write(L.signature, sigX, sigY + 8, 9, '#64748b', {
          lineBreak: false,
          width: sigBlockWidth,
          align: sigAlign,
        });
        if (signatureBuffer) {
          try {
            doc.image(signatureBuffer, sigX, sigY + 20, {
              fit: [sigBlockWidth, 48],
              align: sigAlign,
            });
          } catch (e) {
            // eslint-disable-next-line no-console
            console.error('[prescriptions] embed signature failed', e);
          }
        }
        write(`${L.dr} ${doctor.name}`, sigX, sigY + 74, 11, '#0f172a', {
          lineBreak: false,
          width: sigBlockWidth,
          align: sigAlign,
        });

        if (contactParts.length) {
          const stripY = pageHeight - contactH;
          doc.rect(0, stripY, pageWidth, contactH).fill('#f1f5f9');
          const contactStr = contactParts.join('  •  ');
          write(contactStr, 50, stripY + 12, 9, '#475569', {
            width: innerWidth,
            align: 'center',
            lineBreak: false,
          });
        }

        doc.end();
      } catch (e) {
        reject(e);
      }
    });
  }
}
