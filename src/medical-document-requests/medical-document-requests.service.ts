import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import * as PDFDocument from 'pdfkit';
import * as path from 'path';
import * as fs from 'fs';
import {
  MedicalDocumentRequest,
  MedicalDocumentRequestStatus,
  MedicalDocumentRequestType,
} from '../entities/medical-document-request.entity';
import { Doctor } from '../entities/doctor.entity';
import { Clinic } from '../entities/clinic.entity';
import { PatientProfile } from '../entities/patient-profile.entity';
import { MedicalDocument } from '../entities/medical-document.entity';
import {
  DocumentRequestMeta,
  Message,
} from '../entities/message.entity';
import { resolveApiLocale, type ApiLocale } from '../common/resolve-api-locale';
import { DoctorPatientAccessService } from '../doctor-patient-access/doctor-patient-access.service';
import { PatientConsentService } from '../patients/patient-consent.service';
import { UploadsService } from '../uploads/uploads.service';
import { MedicalRecordImageAnalyzerService } from '../medical-documents/medical-record-image-analyzer.service';
import { PresenceGateway } from '../presence/presence.gateway';
import { CreateMedicalDocumentRequestDto } from './dto/create-medical-document-request.dto';
import { AiDraftRequestDescriptionDto } from './dto/ai-draft-request-description.dto';

const MAX_CONTEXT_STATEMENTS = 5;

const PDF_LABELS = {
  en: {
    docTitle: 'Medical Document Request',
    lab: 'Lab Test Request',
    xray: 'X-Ray / Imaging Request',
    patient: 'Patient',
    description: 'Description',
    signature: 'Signature',
    dr: 'Dr.',
    ref: 'Ref',
    scanToVerify: 'Scan to verify',
    status: 'Status',
    pending: 'Pending',
    fulfilled: 'Fulfilled',
    cancelled: 'Cancelled',
  },
  ar: {
    docTitle: 'طلب مستند طبي',
    lab: 'طلب تحليل معملي',
    xray: 'طلب أشعة / تصوير',
    patient: 'المريض',
    description: 'الوصف',
    signature: 'التوقيع',
    dr: 'د.',
    ref: 'رقم',
    scanToVerify: 'امسح للتحقق',
    status: 'الحالة',
    pending: 'قيد الانتظار',
    fulfilled: 'تم التنفيذ',
    cancelled: 'ملغي',
  },
  de: {
    docTitle: 'Anforderung medizinischer Unterlagen',
    lab: 'Labortest-Anforderung',
    xray: 'Röntgen-/Bildgebungsanforderung',
    patient: 'Patient',
    description: 'Beschreibung',
    signature: 'Unterschrift',
    dr: 'Dr.',
    ref: 'Ref',
    scanToVerify: 'Zum Prüfen scannen',
    status: 'Status',
    pending: 'Ausstehend',
    fulfilled: 'Erledigt',
    cancelled: 'Abgesagt',
  },
  es: {
    docTitle: 'Solicitud de documento médico',
    lab: 'Solicitud de análisis de laboratorio',
    xray: 'Solicitud de radiografía / imagen',
    patient: 'Paciente',
    description: 'Descripción',
    signature: 'Firma',
    dr: 'Dr.',
    ref: 'Ref',
    scanToVerify: 'Escanear para verificar',
    status: 'Estado',
    pending: 'Pendiente',
    fulfilled: 'Completado',
    cancelled: 'Cancelado',
  },
} as const;

function pdfLabelsFor(lang: ApiLocale) {
  return PDF_LABELS[lang] ?? PDF_LABELS.en;
}

function buildRefNumber(row: { id: string; created_at?: Date | string | null }): string {
  const d = new Date(row.created_at ?? Date.now());
  const y = d.getFullYear().toString().slice(-2);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const short = (row.id || '').replace(/-/g, '').slice(-6).toUpperCase();
  return `MDR-${y}${m}${day}-${short}`;
}

@Injectable()
export class MedicalDocumentRequestsService {
  constructor(
    @InjectRepository(MedicalDocumentRequest)
    private repo: Repository<MedicalDocumentRequest>,
    @InjectRepository(Doctor) private doctorRepo: Repository<Doctor>,
    @InjectRepository(Clinic) private clinicRepo: Repository<Clinic>,
    @InjectRepository(PatientProfile)
    private patientProfileRepo: Repository<PatientProfile>,
    @InjectRepository(MedicalDocument)
    private docRepo: Repository<MedicalDocument>,
    @InjectRepository(Message) private messageRepo: Repository<Message>,
    private doctorPatientAccessService: DoctorPatientAccessService,
    private patientConsentService: PatientConsentService,
    private uploads: UploadsService,
    private imageAnalyzer: MedicalRecordImageAnalyzerService,
    private presence: PresenceGateway,
  ) {}

  private readonly logger = new Logger(MedicalDocumentRequestsService.name);

  private async getDoctor(userId: string): Promise<Doctor> {
    const doctor = await this.doctorRepo.findOne({ where: { user_id: userId } });
    if (!doctor) throw new ForbiddenException('Doctor profile not found');
    return doctor;
  }

  /** Builds up to 5 short context statements from the patient profile + recent lab/xray records. */
  private async buildPatientContext(patientUserId: string): Promise<string> {
    const profile = await this.patientProfileRepo.findOne({
      where: { user_id: patientUserId },
    });
    const lines: string[] = [];
    if (profile?.chronic_conditions?.trim()) {
      lines.push(`Chronic conditions: ${profile.chronic_conditions.trim()}`);
    }
    if (profile?.allergies?.trim()) {
      lines.push(`Allergies: ${profile.allergies.trim()}`);
    }
    if (profile?.medical_notes?.trim()) {
      lines.push(`Medical notes: ${profile.medical_notes.trim()}`);
    }

    if (lines.length < MAX_CONTEXT_STATEMENTS) {
      const docs = await this.docRepo.find({
        where: { patient_id: patientUserId },
        order: { created_at: 'DESC' },
        take: MAX_CONTEXT_STATEMENTS,
      });
      for (const doc of docs) {
        if (lines.length >= MAX_CONTEXT_STATEMENTS) break;
        const label = doc.title || doc.type;
        const notes = doc.notes?.trim() ? `: ${doc.notes.trim()}` : '';
        lines.push(`${label}${notes}`);
      }
    }

    return lines.slice(0, MAX_CONTEXT_STATEMENTS).join('\n');
  }

  private documentRequestContent(row: MedicalDocumentRequest): string {
    const kind =
      row.type === MedicalDocumentRequestType.XRAY
        ? 'X-ray request'
        : 'Lab request';
    return `${kind}: ${row.title}`;
  }

  /** Post a document_request bubble into the doctor↔patient chat thread. */
  private async postRequestChatMessage(
    doctorUserId: string,
    patientUserId: string,
    row: MedicalDocumentRequest,
  ): Promise<void> {
    const meta: DocumentRequestMeta = {
      request_id: row.id,
      request_type: row.type === MedicalDocumentRequestType.XRAY ? 'xray' : 'lab',
      title: row.title,
      ...(row.description ? { description: row.description } : {}),
      status: 'pending',
    };
    const created = this.messageRepo.create({
      type: 'document_request',
      content: this.documentRequestContent(row),
      creator: doctorUserId,
      recipient: patientUserId,
      attachment_url: null,
      attachment_meta: meta,
    });
    const saved = await this.messageRepo.save(created);
    const mapped = {
      id: saved.id,
      type: saved.type,
      content: saved.content,
      creator: saved.creator,
      recipient: saved.recipient,
      datetime: saved.datetime,
      attachment_url: saved.attachment_url,
      attachment_meta: saved.attachment_meta,
      read_at: saved.read_at,
      edited_at: saved.edited_at,
    };
    this.presence.emitToUser(patientUserId, 'message:new', {
      message: mapped,
      peer_id: doctorUserId,
    });
    this.presence.emitToUser(doctorUserId, 'message:new', {
      message: mapped,
      peer_id: patientUserId,
    });
  }

  async createForPatient(
    dto: CreateMedicalDocumentRequestDto,
    doctorUserId: string,
  ): Promise<MedicalDocumentRequest> {
    const patientUserId = dto.patient_user_id?.trim();
    if (!patientUserId) throw new BadRequestException('patient_user_id is required');
    if (!dto.title?.trim()) throw new BadRequestException('title is required');

    const doctor = await this.doctorPatientAccessService.assertDoctorCanPrescribeForPatient(
      doctorUserId,
      patientUserId,
    );
    await this.doctorPatientAccessService.assertPatientUser(patientUserId);
    await this.patientConsentService.assertMedicalRecordsStorageConsent(patientUserId);

    const row = this.repo.create({
      doctor_id: doctor.id,
      patient_user_id: patientUserId,
      type: dto.type,
      title: dto.title.trim(),
      description: dto.description?.trim() || null,
      status: MedicalDocumentRequestStatus.PENDING,
    });
    const saved = await this.repo.save(row);

    // Always mirror into the chat thread so patients see the request where they talk.
    try {
      await this.postRequestChatMessage(doctorUserId, patientUserId, saved);
    } catch (e) {
      // Request itself succeeded — don't fail create if chat notify fails.
      // eslint-disable-next-line no-console
      console.error('[medical-document-requests] chat notify failed', e);
    }

    return saved;
  }

  async draftDescription(
    dto: AiDraftRequestDescriptionDto,
    doctorUserId: string,
  ): Promise<{ description: string }> {
    const patientUserId = dto.patient_user_id?.trim();
    if (!patientUserId) throw new BadRequestException('patient_user_id is required');
    if (!dto.title?.trim()) throw new BadRequestException('title is required');

    await this.doctorPatientAccessService.assertDoctorCanPrescribeForPatient(
      doctorUserId,
      patientUserId,
    );

    const patientContext = await this.buildPatientContext(patientUserId);
    const description = await this.imageAnalyzer.draftRequestDescription({
      title: dto.title.trim(),
      type: dto.type,
      patientContext,
      outputLang: resolveApiLocale(dto.lang),
    });
    return { description };
  }

  private async getDoctorReadAccess(
    doctorUserId: string,
    patientUserId: string,
  ): Promise<{ doctor: Doctor; recordsAllowed: boolean }> {
    const doctor = await this.getDoctor(doctorUserId);
    const row = await this.doctorPatientAccessService.findOrCreate(patientUserId, doctor.id);
    if (row.blocked_by_patient || row.blocked_by_doctor) {
      throw new ForbiddenException('Chat is blocked between these users');
    }
    return { doctor, recordsAllowed: row.records_allowed };
  }

  async listForPatientAsDoctor(patientUserId: string, doctorUserId: string) {
    const { doctor, recordsAllowed } = await this.getDoctorReadAccess(
      doctorUserId,
      patientUserId,
    );
    const where: { patient_user_id: string; doctor_id?: string } = {
      patient_user_id: patientUserId,
    };
    if (!recordsAllowed) where.doctor_id = doctor.id;
    const rows = await this.repo.find({ where, order: { created_at: 'DESC' } });
    return this.withDoctorNames(rows);
  }

  async cancel(id: string, doctorUserId: string): Promise<MedicalDocumentRequest> {
    const doctor = await this.getDoctor(doctorUserId);
    const row = await this.repo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Request not found');
    if (row.doctor_id !== doctor.id) {
      throw new ForbiddenException('You can only cancel requests you created');
    }
    if (row.status !== MedicalDocumentRequestStatus.PENDING) {
      throw new BadRequestException('Only pending requests can be cancelled');
    }
    row.status = MedicalDocumentRequestStatus.CANCELLED;
    const saved = await this.repo.save(row);
    await this.markChatRequestStatus(id, 'cancelled');
    return saved;
  }

  async listForPatientUser(userId: string) {
    const rows = await this.repo.find({
      where: { patient_user_id: userId },
      order: { created_at: 'DESC' },
    });
    return this.withDoctorNames(rows);
  }

  async findOneForPatientUser(id: string, userId: string) {
    const row = await this.requirePatientRequest(id, userId);
    const doctor = await this.doctorRepo.findOne({ where: { id: row.doctor_id } });
    return this.withDoctorName(row, doctor?.name);
  }

  async findOneForDoctor(id: string, doctorUserId: string) {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Request not found');
    const { doctor, recordsAllowed } = await this.getDoctorReadAccess(
      doctorUserId,
      row.patient_user_id,
    );
    if (row.doctor_id !== doctor.id && !recordsAllowed) {
      throw new NotFoundException('Request not found');
    }
    const owner =
      row.doctor_id === doctor.id
        ? doctor
        : await this.doctorRepo.findOne({ where: { id: row.doctor_id } });
    return this.withDoctorName(row, owner?.name ?? null);
  }

  async getOrGeneratePdfForDoctor(
    id: string,
    doctorUserId: string,
    opts: { lang?: ApiLocale; regenerate?: boolean } = {},
  ): Promise<{ pdf_url: string }> {
    await this.findOneForDoctor(id, doctorUserId);
    const entity = await this.repo.findOne({ where: { id } });
    if (!entity) throw new NotFoundException('Request not found');
    if (entity.pdf_url && !opts.regenerate) {
      return { pdf_url: entity.pdf_url };
    }
    const pdf_url = await this.generateAndStorePdf(entity, opts.lang ?? 'en');
    return { pdf_url };
  }

  private async requirePatientRequest(id: string, userId: string) {
    const row = await this.repo.findOne({ where: { id } });
    if (!row || row.patient_user_id !== userId) {
      throw new NotFoundException('Request not found');
    }
    return row;
  }

  private async withDoctorNames(rows: MedicalDocumentRequest[]) {
    if (!rows.length) return [];
    const doctorIds = [...new Set(rows.map((r) => r.doctor_id))];
    const doctors = await this.doctorRepo.find({ where: { id: In(doctorIds) } });
    const nameById = new Map(doctors.map((d) => [d.id, d.name]));
    return rows.map((row) => this.withDoctorName(row, nameById.get(row.doctor_id)));
  }

  private withDoctorName(row: MedicalDocumentRequest, doctorName?: string | null) {
    return {
      ...row,
      doctor_name: doctorName ?? null,
    };
  }

  async fulfill(
    id: string,
    userId: string,
    documentId: string,
  ): Promise<MedicalDocumentRequest> {
    const row = await this.requirePatientRequest(id, userId);
    if (row.status === MedicalDocumentRequestStatus.CANCELLED) {
      throw new BadRequestException('This request was cancelled');
    }
    const doc = await this.docRepo.findOne({ where: { id: documentId } });
    if (!doc || doc.patient_id !== userId) {
      throw new NotFoundException('Document not found');
    }
    if (String(doc.type).toLowerCase() !== String(row.type).toLowerCase()) {
      throw new BadRequestException(
        `Document type must match the request type (${row.type})`,
      );
    }
    const snapshot = { ...row };
    await this.markChatRequestStatus(row.id, 'fulfilled', doc.id);
    await this.notifyDoctorOfUpload(row, doc, userId);
    await this.repo.remove(row);
    return {
      ...snapshot,
      fulfilled_document_id: doc.id,
      status: MedicalDocumentRequestStatus.FULFILLED,
    } as MedicalDocumentRequest;
  }

  /**
   * Post the uploaded result into the chat as a message from the patient.
   * Flipping the old request bubble to "fulfilled" is easy for the doctor to
   * miss — this gives them an unread message and a push like any other.
   */
  private async notifyDoctorOfUpload(
    request: MedicalDocumentRequest,
    doc: MedicalDocument,
    patientUserId: string,
  ): Promise<void> {
    const doctor = await this.doctorRepo.findOne({
      where: { id: request.doctor_id },
    });
    if (!doctor?.user_id) return;

    const doctorUserId = doctor.user_id;
    const title = request.title?.trim() || doc.title?.trim() || 'Result';
    const isXray = request.type === MedicalDocumentRequestType.XRAY;

    try {
      // Written straight to the repo, like postRequestChatMessage above: results
      // usually arrive days later, long after the consultation closed, and
      // MessagesService would reject it for having no open consultation.
      const created = this.messageRepo.create({
        type: 'medical_link' as const,
        content: `${isXray ? 'X-ray' : 'Lab'} result uploaded: ${title}`,
        creator: patientUserId,
        recipient: doctorUserId,
        attachment_url: null,
        attachment_meta: {
          record_type: isXray ? ('xray' as const) : ('lab' as const),
          record_id: doc.id,
          title,
        },
      });
      const saved = await this.messageRepo.save(created);
      const mapped = {
        id: saved.id,
        type: saved.type,
        content: saved.content,
        creator: saved.creator,
        recipient: saved.recipient,
        datetime: saved.datetime,
        attachment_url: saved.attachment_url,
        attachment_meta: saved.attachment_meta,
        read_at: saved.read_at,
        edited_at: saved.edited_at,
      };
      this.presence.emitToUser(doctorUserId, 'message:new', {
        message: mapped,
        peer_id: patientUserId,
      });
      this.presence.emitToUser(patientUserId, 'message:new', {
        message: mapped,
        peer_id: doctorUserId,
      });
    } catch (err) {
      // The upload itself succeeded — never fail it over a chat notification.
      this.logger.error('Failed to post uploaded result to chat', err);
    }
  }

  private async markChatRequestStatus(
    requestId: string,
    status: 'fulfilled' | 'cancelled',
    fulfilledDocumentId?: string,
  ): Promise<void> {
    const messages = await this.messageRepo
      .createQueryBuilder('m')
      .where('m.type = :type', { type: 'document_request' })
      .andWhere(`m.attachment_meta ->> 'request_id' = :requestId`, { requestId })
      .getMany();
    if (!messages.length) return;
    for (const msg of messages) {
      const meta = (msg.attachment_meta ?? {}) as DocumentRequestMeta;
      msg.attachment_meta = {
        ...meta,
        status,
        ...(fulfilledDocumentId
          ? { fulfilled_document_id: fulfilledDocumentId }
          : {}),
      };
    }
    const saved = await this.messageRepo.save(messages);
    for (const msg of saved) {
      const mapped = {
        id: msg.id,
        type: msg.type,
        content: msg.content,
        creator: msg.creator,
        recipient: msg.recipient,
        datetime: msg.datetime,
        attachment_url: msg.attachment_url,
        attachment_meta: msg.attachment_meta,
        read_at: msg.read_at,
        edited_at: msg.edited_at,
      };
      this.presence.emitToUser(msg.recipient, 'message:updated', {
        message: mapped,
        peer_id: msg.creator,
      });
      this.presence.emitToUser(msg.creator, 'message:updated', {
        message: mapped,
        peer_id: msg.recipient,
      });
    }
  }

  async getOrGeneratePdfForPatientUser(
    id: string,
    userId: string,
    opts: { lang?: ApiLocale; regenerate?: boolean } = {},
  ): Promise<{ pdf_url: string }> {
    const row = await this.requirePatientRequest(id, userId);
    if (row.pdf_url && !opts.regenerate) {
      return { pdf_url: row.pdf_url };
    }
    const pdf_url = await this.generateAndStorePdf(row, opts.lang ?? 'en');
    return { pdf_url };
  }

  private load3elagiLogoBuffer(): Buffer | null {
    const logoPath = path.join(process.cwd(), 'assets/images/3elagi-mark.png');
    try {
      if (fs.existsSync(logoPath)) return fs.readFileSync(logoPath);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[medical-document-requests] load 3elagi logo failed', e);
    }
    return null;
  }

  private async generateAndStorePdf(
    row: MedicalDocumentRequest,
    lang: ApiLocale = 'en',
  ): Promise<string> {
    const doctor = await this.doctorRepo.findOne({ where: { id: row.doctor_id } });
    if (!doctor) throw new NotFoundException('Doctor not found for this request');

    const clinic = doctor.default_clinic_id
      ? await this.clinicRepo.findOne({ where: { id: doctor.default_clinic_id } })
      : null;
    const profile = await this.patientProfileRepo.findOne({
      where: { user_id: row.patient_user_id },
    });

    const signatureBuffer = doctor.digital_signature_url
      ? await this.uploads.getBufferFromUrl(doctor.digital_signature_url)
      : null;
    const logoBuffer = this.load3elagiLogoBuffer();

    const pdfBuffer = await this.renderPdf(
      row,
      doctor,
      { name: profile?.name ?? 'Patient', phone: profile?.phone ?? '' },
      clinic,
      signatureBuffer,
      logoBuffer,
      lang,
    );

    const upload = await this.uploads.uploadFile({
      originalname: `medical-document-request-${row.id}.pdf`,
      mimetype: 'application/pdf',
      buffer: pdfBuffer,
      size: pdfBuffer.length,
    } as Express.Multer.File);

    row.pdf_url = upload.url;
    await this.repo.update(row.id, { pdf_url: upload.url });
    return upload.url;
  }

  private async renderPdf(
    row: MedicalDocumentRequest,
    doctor: Doctor,
    patient: { name: string; phone: string },
    clinic: Clinic | null,
    signatureBuffer: Buffer | null,
    logoBuffer: Buffer | null,
    lang: ApiLocale = 'en',
  ): Promise<Buffer> {
    const refNo = buildRefNumber(row);

    return new Promise((resolve, reject) => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const doc: any = new (PDFDocument as any)({
          size: 'A4',
          // margin: 0 so edge-to-edge header/footer never trip PDFKit's
          // bottom-margin page-break (which was creating trailing blank pages).
          margin: 0,
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
        const innerWidth = pageWidth - 100;

        const arFontPath = path.join(process.cwd(), 'assets/fonts/NotoSansArabic-Regular.ttf');
        let arFontLoaded = false;
        if (fs.existsSync(arFontPath)) {
          try {
            doc.registerFont('AR', arFontPath);
            arFontLoaded = true;
          } catch (e) {
            // eslint-disable-next-line no-console
            console.error('[medical-document-requests] register Arabic font failed', e);
          }
        }

        const ARABIC_RE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
        const hasArabic = (s: string) => ARABIC_RE.test(s ?? '');

        const setFontFor = (s: string, size: number) => {
          if (arFontLoaded && (isAr || hasArabic(s))) doc.font('AR');
          else doc.font('Helvetica');
          doc.fontSize(size);
        };

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
            console.error('[medical-document-requests] embed logo failed', e);
          }
        } else {
          write('3elagi', logoX, logoY + 18, 14, '#ffffff', {
            width: logoSize + 40,
            align: isAr ? 'left' : 'right',
            lineBreak: false,
          });
        }

        const nameBlockX = isAr ? pageWidth - 50 - innerWidth : 50;
        write(`${L.dr} ${doctor.name}`, nameBlockX, 28, 22, '#ffffff', {
          align: isAr ? 'right' : 'left',
          width: innerWidth * 0.55,
        });
        write(L.docTitle, nameBlockX, 62, 10, '#ffffff', {
          align: isAr ? 'right' : 'left',
          width: innerWidth * 0.55,
        });

        const clinicTextWidth = innerWidth - (logoSize + 16);
        const clinicTextX = isAr ? logoX + logoSize + 16 : 50;
        const clinicName = clinic?.name ?? doctor.personal_clinic_location ?? '';
        const clinicLoc = clinic?.location ?? '';
        // Clinic details sit under/near the logo side (same pattern as prescriptions)
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
        write(`${L.ref}: ${refNo}`, clinicTextX, 70, 8, '#ffffff', {
          align: isAr ? 'left' : 'right',
          width: clinicTextWidth,
        });

        let y = 130;

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

        y += 60;
        doc.moveTo(50, y).lineTo(pageWidth - 50, y).strokeColor('#e2e8f0').stroke();
        y += 20;

        const typeLabel = row.type === MedicalDocumentRequestType.XRAY ? L.xray : L.lab;
        write(typeLabel, 50, y, 16, PRIMARY);
        y = doc.y + 4;

        write(row.title, 50, y, 13, '#0f172a');
        y = doc.y + 6;

        write(
          new Date(row.created_at ?? Date.now()).toLocaleDateString(isAr ? 'ar-EG' : 'en-GB'),
          50,
          y,
          9,
          '#64748b',
          { align: isAr ? 'right' : 'left' },
        );
        y = doc.y + 14;

        const statusLabel =
          row.status === MedicalDocumentRequestStatus.FULFILLED
            ? L.fulfilled
            : row.status === MedicalDocumentRequestStatus.CANCELLED
              ? L.cancelled
              : L.pending;
        write(`${L.status}: ${statusLabel}`, 50, y, 9, '#64748b');
        y = doc.y + 16;

        if (row.description) {
          write(L.description, 50, y, 10, '#475569');
          y = doc.y + 4;
          write(row.description, 50, y, 11, '#0f172a');
          y = doc.y + 16;
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
          sigY = Math.max(sigY, bottomAnchoredY);
        } else {
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
            console.error('[medical-document-requests] embed signature failed', e);
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
          write(contactParts.join('  •  '), 50, stripY + 12, 9, '#475569', {
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
