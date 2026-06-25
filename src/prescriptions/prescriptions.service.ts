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
import * as QRCode from 'qrcode';
import { Prescription, PrescriptionItem } from '../entities/prescription.entity';
import { PrescriptionMedication } from '../entities/prescription-medication.entity';
import { Doctor } from '../entities/doctor.entity';
import { Patient } from '../entities/patient.entity';
import { Clinic } from '../entities/clinic.entity';
import { PatientProfile } from '../entities/patient-profile.entity';
import { User, UserRole } from '../entities/user.entity';
import { UploadsService } from '../uploads/uploads.service';
import { KnowledgeIndexerService } from '../ai/knowledge-indexer.service';
import { DoctorPatientAccessService } from '../doctor-patient-access/doctor-patient-access.service';
import { PointsService } from '../points/points.service';
import {
  ExtractedPrescriptionMedication,
  PrescriptionImageAnalyzerService,
} from './prescription-image-analyzer.service';

interface CreatePrescriptionDto {
  patient_id: string;
  title: string;
  symptoms?: string;
  items: PrescriptionItem[];
  lang?: 'ar' | 'en';
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
  lang?: 'ar' | 'en';
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
    scanToVerify: 'Scan to verify',
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
    scanToVerify: 'امسح للتحقق',
  },
} as const;

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
    private uploads: UploadsService,
    private knowledgeIndexer: KnowledgeIndexerService,
    private doctorPatientAccessService: DoctorPatientAccessService,
    private imageAnalyzer: PrescriptionImageAnalyzerService,
    private pointsService: PointsService,
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

  private async attachDoctorNames(rows: Prescription[]): Promise<
    (Prescription & { doctor_name?: string | null })[]
  > {
    if (!rows.length) return rows;
    const doctorIds = [...new Set(rows.map((row) => row.doctor_id))];
    const doctors = await this.doctorRepo.find({ where: { id: In(doctorIds) } });
    const byId = new Map(doctors.map((doctor) => [doctor.id, doctor.name]));
    return rows.map((row) => ({
      ...row,
      doctor_name: byId.get(row.doctor_id) ?? null,
    }));
  }

  private async getDoctor(userId: string): Promise<Doctor> {
    const doctor = await this.doctorRepo.findOne({ where: { user_id: userId } });
    if (!doctor) throw new ForbiddenException('Doctor profile not found');
    return doctor;
  }

  async listForPatient(patientId: string, userId: string, role: string) {
    const patient = await this.patientRepo.findOne({ where: { id: patientId } });
    if (!patient) throw new NotFoundException('Patient not found');

    if (role === 'doctor') {
      const doctor = await this.getDoctor(userId);
      if (doctor.default_clinic_id !== patient.clinic_id) {
        const own = await this.repo.find({
          where: { patient_id: patientId, doctor_id: doctor.id },
          order: { created_at: 'DESC' },
        });
        return own;
      }
    }

    return this.repo.find({
      where: { patient_id: patientId },
      order: { created_at: 'DESC' },
    });
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
    return this.attachDoctorNames(rows);
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

    const [enriched] = await this.attachDoctorNames([row]);
    return enriched;
  }

  async analyzeImageBuffer(
    userId: string,
    buffer: Buffer,
    mimeType: string,
    outputLang: 'ar' | 'en' = 'en',
  ) {
    await this.pointsService.deductForMessage(userId, PRESCRIPTION_IMAGE_POINT_COST);
    return this.imageAnalyzer.extractMedications(
      buffer.toString('base64'),
      mimeType,
      outputLang,
    );
  }

  async analyzeImage(
    userId: string,
    imageBase64: string,
    mimeType: string,
    outputLang: 'ar' | 'en' = 'en',
  ): Promise<ExtractedPrescriptionMedication[]> {
    await this.pointsService.deductForMessage(userId, PRESCRIPTION_IMAGE_POINT_COST);
    return this.imageAnalyzer.extractMedications(
      imageBase64,
      mimeType,
      outputLang,
    );
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
        const signatureBuffer = doctor.digital_signature_url
          ? await this.uploads.getBufferFromUrl(doctor.digital_signature_url)
          : null;
        const logoBuffer = clinic?.logo_url
          ? await this.uploads.getBufferFromUrl(clinic.logo_url).catch(() => null)
          : null;
        const pseudoPatient = {
          name: patientDisplayName,
          phone: patientPhone,
          age: null as number | null,
        } as Patient;
        const pdfBuffer = await this.renderPdf(
          saved,
          doctor,
          pseudoPatient,
          clinic,
          signatureBuffer,
          logoBuffer,
          dto.lang === 'ar' ? 'ar' : 'en',
        );
        const upload = await this.uploads.uploadFile({
          originalname: `prescription-${saved.id}.pdf`,
          mimetype: 'application/pdf',
          buffer: pdfBuffer,
          size: pdfBuffer.length,
        } as Express.Multer.File);
        saved.pdf_url = upload.url;
        await this.repo.update(saved.id, { pdf_url: upload.url });
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
    if (!patient) throw new NotFoundException('Patient not found');

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
      const signatureBuffer = doctor.digital_signature_url
        ? await this.uploads.getBufferFromUrl(doctor.digital_signature_url)
        : null;
      const logoBuffer = clinic?.logo_url
        ? await this.uploads.getBufferFromUrl(clinic.logo_url).catch(() => null)
        : null;
      const pdfBuffer = await this.renderPdf(
        saved,
        doctor,
        patient,
        clinic,
        signatureBuffer,
        logoBuffer,
        dto.lang === 'ar' ? 'ar' : 'en',
      );
      const upload = await this.uploads.uploadFile({
        originalname: `prescription-${saved.id}.pdf`,
        mimetype: 'application/pdf',
        buffer: pdfBuffer,
        size: pdfBuffer.length,
      } as Express.Multer.File);
      saved.pdf_url = upload.url;
      await this.repo.update(saved.id, { pdf_url: upload.url });
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
    lang: 'ar' | 'en' = 'en',
  ): Promise<Buffer> {
    const refNo = buildRefNumber(rx);
    let qrBuffer: Buffer | null = null;
    try {
      const qrPayload = `RX:${rx.id}`;
      qrBuffer = await QRCode.toBuffer(qrPayload, {
        margin: 1,
        scale: 6,
        color: { dark: '#0f172a', light: '#ffffff' },
      });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[prescriptions] QR generation failed', e);
    }

    return new Promise((resolve, reject) => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const doc: any = new (PDFDocument as any)({ size: 'A4', margin: 50 });
        const chunks: Buffer[] = [];
        doc.on('data', (c: Buffer) => chunks.push(c));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        const PRIMARY = '#3057F2';
        const L = PDF_LABELS[lang];
        const isAr = lang === 'ar';
        const pageWidth = doc.page.width;
        const innerWidth = pageWidth - 100;

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

        // Optional clinic logo (right in EN, left in AR — opposite the doctor name)
        const logoSize = 56;
        const logoY = (headerH - logoSize) / 2;
        const logoX = isAr ? 30 : pageWidth - 30 - logoSize;
        if (logoBuffer) {
          try {
            // Soft white circle behind logo for visibility
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

        // Signature footer (anchored within the last page)
        const sigY = doc.page.height - 170;
        doc.moveTo(50, sigY).lineTo(pageWidth - 50, sigY).strokeColor('#e2e8f0').stroke();

        // QR code on the side opposite the signature
        const qrSize = 70;
        const qrX = isAr ? pageWidth - 50 - qrSize : 50;
        const qrTextX = qrX;
        if (qrBuffer) {
          try {
            doc.image(qrBuffer, qrX, sigY + 10, { fit: [qrSize, qrSize] });
            write(L.scanToVerify, qrTextX, sigY + 10 + qrSize + 2, 7, '#94a3b8', {
              width: qrSize,
              align: 'center',
              lineBreak: false,
            });
          } catch (e) {
            // eslint-disable-next-line no-console
            console.error('[prescriptions] embed QR failed', e);
          }
        }

        const sigBlockWidth = 180;
        const sigX = isAr ? 50 : pageWidth - 50 - sigBlockWidth;
        const sigAlign: 'right' | 'left' = isAr ? 'right' : 'left';
        write(L.signature, sigX, sigY + 6, 9, '#64748b', {
          lineBreak: false,
          width: sigBlockWidth,
          align: sigAlign,
        });
        if (signatureBuffer) {
          try {
            doc.image(signatureBuffer, sigX, sigY + 18, {
              fit: [sigBlockWidth, 50],
              align: sigAlign,
            });
          } catch (e) {
            // eslint-disable-next-line no-console
            console.error('[prescriptions] embed signature failed', e);
          }
        }
        write(`${L.dr} ${doctor.name}`, sigX, sigY + 72, 11, '#0f172a', {
          lineBreak: false,
          width: sigBlockWidth,
          align: sigAlign,
        });

        // Bottom contact strip with clinic phone + location
        const contactParts: string[] = [];
        if (clinic?.phone) contactParts.push(clinic.phone);
        if (clinic?.location) contactParts.push(clinic.location);
        if (contactParts.length) {
          const stripY = doc.page.height - 36;
          doc.rect(0, stripY, pageWidth, 36).fill('#f1f5f9');
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
