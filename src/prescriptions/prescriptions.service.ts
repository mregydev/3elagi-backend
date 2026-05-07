import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as PDFDocument from 'pdfkit';
import * as path from 'path';
import * as fs from 'fs';
import * as QRCode from 'qrcode';
import { Prescription, PrescriptionItem } from '../entities/prescription.entity';
import { Doctor } from '../entities/doctor.entity';
import { Patient } from '../entities/patient.entity';
import { Clinic } from '../entities/clinic.entity';
import { UploadsService } from '../uploads/uploads.service';

interface CreatePrescriptionDto {
  patient_id: string;
  title: string;
  symptoms?: string;
  items: PrescriptionItem[];
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
    @InjectRepository(Doctor) private doctorRepo: Repository<Doctor>,
    @InjectRepository(Patient) private patientRepo: Repository<Patient>,
    @InjectRepository(Clinic) private clinicRepo: Repository<Clinic>,
    private uploads: UploadsService,
  ) {}

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
    return { items: last.items ?? [], symptoms: last.symptoms ?? null };
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

        const items = rx.items ?? [];
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
