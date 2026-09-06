import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LLM_PROVIDER } from '../ai/llm/llm.tokens';
import type { LlmProvider } from '../ai/llm/llm.types';
import { DoctorSpeciality } from '../entities/doctor-speciality.entity';
import { Doctor } from '../entities/doctor.entity';
import { MedicalDocument, DocumentType } from '../entities/medical-document.entity';
import { Message } from '../entities/message.entity';
import { PatientProfile } from '../entities/patient-profile.entity';
import { SpecialtyTestAccount } from '../entities/specialty-test-account.entity';
import { User, UserRole } from '../entities/user.entity';
import { PresenceGateway } from '../presence/presence.gateway';
import { PushNotificationsService } from '../push-notifications/push-notifications.service';
import { UsersService } from '../users/users.service';
import {
  DEFAULT_TEST_PATIENT_DISPLAY_NAME,
  MAX_TEST_PATIENT_DOCTOR_QUESTIONS,
  seedsForSpeciality,
  TEST_PATIENT_WELCOME_MESSAGE,
} from './specialty-test.constants';
import { DoctorOnboardingService } from './doctor-onboarding.service';

const CHAT_HISTORY_LIMIT = 24;
const SHARE_RECORDS_DELAY_MS = 900;

type ShareRecordsIntent = 'lab' | 'xray' | 'all';

@Injectable()
export class TestPatientAiService {
  private readonly logger = new Logger(TestPatientAiService.name);

  constructor(
    @InjectRepository(PatientProfile)
    private patientProfileRepo: Repository<PatientProfile>,
    @InjectRepository(Message) private messageRepo: Repository<Message>,
    @InjectRepository(SpecialtyTestAccount)
    private testAccountRepo: Repository<SpecialtyTestAccount>,
    @InjectRepository(Doctor) private doctorRepo: Repository<Doctor>,
    @InjectRepository(DoctorSpeciality)
    private specialityRepo: Repository<DoctorSpeciality>,
    @InjectRepository(MedicalDocument)
    private medicalDocRepo: Repository<MedicalDocument>,
    @InjectRepository(User) private userRepo: Repository<User>,
    @Inject(LLM_PROVIDER) private readonly llm: LlmProvider,
    private presence: PresenceGateway,
    private pushNotifications: PushNotificationsService,
    private users: UsersService,
    private doctorOnboarding: DoctorOnboardingService,
  ) {}

  async isSpecialtyTestPatient(userId: string): Promise<boolean> {
    const profile = await this.patientProfileRepo.findOne({
      where: { user_id: userId },
      select: { is_specialty_test_account: true },
    });
    return profile?.is_specialty_test_account === true;
  }

  async countDoctorTextQuestions(
    doctorUserId: string,
    patientUserId: string,
  ): Promise<number> {
    return this.messageRepo.count({
      where: {
        type: 'text',
        creator: doctorUserId,
        recipient: patientUserId,
      },
    });
  }

  async assertDoctorCanAskTestPatient(
    doctorUserId: string,
    patientUserId: string,
  ): Promise<void> {
    if (!(await this.isSpecialtyTestPatient(patientUserId))) return;
    const count = await this.countDoctorTextQuestions(doctorUserId, patientUserId);
    if (count >= MAX_TEST_PATIENT_DOCTOR_QUESTIONS) {
      throw new BadRequestException(
        `The demo patient allows up to ${MAX_TEST_PATIENT_DOCTOR_QUESTIONS} questions. Start a real consultation to continue.`,
      );
    }
  }

  async getChatStatus(doctorUserId: string, patientUserId: string) {
    const isTestPatient = await this.isSpecialtyTestPatient(patientUserId);
    if (!isTestPatient) {
      return {
        is_test_patient: false,
        questions_asked: 0,
        max_questions: MAX_TEST_PATIENT_DOCTOR_QUESTIONS,
        chat_open: false,
      };
    }

    const allowedDemoId = await this.resolveDemoPatientUserIdForDoctor(doctorUserId);
    if (!allowedDemoId || allowedDemoId !== patientUserId) {
      return {
        is_test_patient: false,
        questions_asked: 0,
        max_questions: MAX_TEST_PATIENT_DOCTOR_QUESTIONS,
        chat_open: false,
      };
    }

    await this.ensureDoctorCanChatWithTestPatient(doctorUserId, patientUserId);

    const questionsAsked = await this.countDoctorTextQuestions(
      doctorUserId,
      patientUserId,
    );
    return {
      is_test_patient: true,
      questions_asked: questionsAsked,
      max_questions: MAX_TEST_PATIENT_DOCTOR_QUESTIONS,
      display_name: DEFAULT_TEST_PATIENT_DISPLAY_NAME,
      chat_open: true,
    };
  }

  /** Demo patient chats skip consultations — grant access and a welcome message on first open. */
  async ensureDoctorCanChatWithTestPatient(
    doctorUserId: string,
    patientUserId: string,
  ): Promise<void> {
    if (!(await this.isSpecialtyTestPatient(patientUserId))) return;

    await this.assertDoctorOwnsDemoPatient(doctorUserId, patientUserId);

    await this.doctorOnboarding.grantTestPatientAccessForDoctorUser(
      doctorUserId,
      patientUserId,
    );

    const existingWelcome = await this.messageRepo.findOne({
      where: {
        creator: patientUserId,
        recipient: doctorUserId,
        content: TEST_PATIENT_WELCOME_MESSAGE,
      },
    });
    if (!existingWelcome) {
      await this.messageRepo.save(
        this.messageRepo.create({
          type: 'text',
          content: TEST_PATIENT_WELCOME_MESSAGE,
          creator: patientUserId,
          recipient: doctorUserId,
          datetime: new Date(),
        }),
      );
    }
  }

  async involvesSpecialtyTestPatient(userA: string, userB: string): Promise<boolean> {
    return (
      (await this.isSpecialtyTestPatient(userA)) ||
      (await this.isSpecialtyTestPatient(userB))
    );
  }

  async resolveDemoPatientUserIdForDoctor(doctorUserId: string): Promise<string | null> {
    const doctor = await this.doctorRepo.findOne({ where: { user_id: doctorUserId } });
    if (!doctor?.speciality_id) return null;
    if (doctor.onboarding_test_patient_user_id) {
      if (await this.isSpecialtyTestPatient(doctor.onboarding_test_patient_user_id)) {
        return doctor.onboarding_test_patient_user_id;
      }
    }
    const row = await this.testAccountRepo.findOne({
      where: { speciality_id: doctor.speciality_id },
    });
    return row?.patient_user_id ?? null;
  }

  /** Hide demo patients from other specialities in a doctor's inbox. */
  async filterConversationPeersForDoctor(
    doctorUserId: string,
    peerIds: string[],
  ): Promise<string[]> {
    if (!peerIds.length) return peerIds;

    const allowedDemoId = await this.resolveDemoPatientUserIdForDoctor(doctorUserId);
    const testRows = await this.testAccountRepo.find({ select: ['patient_user_id'] });
    const allDemoIds = new Set(testRows.map((row) => row.patient_user_id));

    return peerIds.filter((peerId) => {
      if (!allDemoIds.has(peerId)) return true;
      return peerId === allowedDemoId;
    });
  }

  private async assertDoctorOwnsDemoPatient(
    doctorUserId: string,
    patientUserId: string,
  ): Promise<void> {
    if (!(await this.isSpecialtyTestPatient(patientUserId))) return;
    const allowed = await this.resolveDemoPatientUserIdForDoctor(doctorUserId);
    if (!allowed || allowed !== patientUserId) {
      throw new ForbiddenException(
        'This demo patient is not available for your specialty.',
      );
    }
  }

  /** Fire-and-forget Gemini reply after a doctor text message to the demo patient. */
  voidReplyToDoctor(
    doctorUserId: string,
    patientUserId: string,
    doctorMessage: string,
  ): void {
    void this.generateAndPostReply(doctorUserId, patientUserId, doctorMessage).catch(
      (err) => {
        this.logger.error('Test patient AI reply failed', err);
      },
    );
  }

  private async generateAndPostReply(
    doctorUserId: string,
    patientUserId: string,
    doctorMessage: string,
  ): Promise<void> {
    if (!(await this.isSpecialtyTestPatient(patientUserId))) return;

    const context = await this.buildPatientContext(patientUserId, doctorUserId);
    const history = await this.loadChatHistory(doctorUserId, patientUserId);

    const systemPrompt = [
      `You are role-playing as "${DEFAULT_TEST_PATIENT_DISPLAY_NAME}", a simulated patient on the 3elagi telemedicine platform.`,
      `The consulting doctor's specialty context is: ${context.specialityName}.`,
      'Answer as a realistic patient in first person. Be concise (usually under 120 words).',
      'Base answers on the medical history below. Invent plausible symptom details that fit the records if needed.',
      'Never say you are an AI, a bot, or a test account.',
      'If the doctor asks for labs, imaging, or medical records, reply briefly — matching files are shared automatically in the chat as record cards right after your message.',
      '',
      'Medical history on file:',
      context.historySummary,
    ].join('\n');

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      ...history,
      { role: 'user' as const, content: doctorMessage },
    ];

    let reply: string;
    try {
      reply = (await this.llm.chat(messages)).trim();
    } catch (err) {
      this.logger.error('Gemini failed for test patient', err);
      reply =
        'Sorry doctor, I am having trouble responding right now. Could you please repeat your question?';
    }

    if (!reply) {
      reply = 'Could you clarify that for me, doctor?';
    }

    const created = this.messageRepo.create({
      type: 'text',
      content: reply,
      creator: patientUserId,
      recipient: doctorUserId,
      datetime: new Date(),
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

    const patientName = DEFAULT_TEST_PATIENT_DISPLAY_NAME;
    this.presence.emitToUser(doctorUserId, 'message:new', {
      message: mapped,
      peer_id: patientUserId,
      peer_name: patientName,
    });
    this.presence.emitToUser(patientUserId, 'message:new', {
      message: mapped,
      peer_id: doctorUserId,
    });

    try {
      await this.pushNotifications.sendChatMessage({
        recipientId: doctorUserId,
        chatId: patientUserId,
        messageId: saved.id,
        senderId: patientUserId,
        senderName: patientName,
        body: reply.slice(0, 180),
      });
    } catch (err) {
      this.logger.error('Failed to push test patient reply', err);
    }

    const shareIntent = this.detectShareRecordsIntent(doctorMessage);
    if (shareIntent) {
      await this.delay(SHARE_RECORDS_DELAY_MS);
      await this.shareMedicalRecords(
        doctorUserId,
        patientUserId,
        shareIntent,
        doctorMessage,
      );
    }
  }

  /** Detect when the doctor is asking the patient to share lab/imaging/records. */
  private detectShareRecordsIntent(message: string): ShareRecordsIntent | null {
    const lower = message.trim().toLowerCase();
    if (!lower) return null;

    const labHint =
      /\b(lab|labs|blood|cbc|metabolic|pathology|urine|biopsy|culture|panel|تحليل|تحاليل|مختبر|دم)\b/.test(
        lower,
      );
    const xrayHint =
      /\b(x-?ray|xray|scan|scans|imaging|mri|ct\b|ultrasound|echo|radiograph|أشعة|مسح|تصوير)\b/.test(
        lower,
      );
    const shareHint =
      /\b(share|send|upload|attach|provide|show me|can i see|could you|please send|give me|open your|see your|look at your|مشاركة|ارسل|أرسل|ارفع|أرفع|اعرض|أعرض)\b/.test(
        lower,
      );
    const recordHint =
      /\b(record|records|result|results|report|reports|document|documents|file|files|medical|سجل|سجلات|نتيجة|نتائج|تقرير|تقارير|ملف)\b/.test(
        lower,
      );
    const requestHint =
      /\b(request|need|want|order|get|fetch|pull up|اطلب|أحتاج|محتاج)\b/.test(lower);

    if (!(shareHint || recordHint || requestHint || labHint || xrayHint)) {
      return null;
    }

    if (labHint && xrayHint) return 'all';
    if (labHint) return 'lab';
    if (xrayHint) return 'xray';
    if (shareHint || recordHint || requestHint) return 'all';
    return null;
  }

  private async shareMedicalRecords(
    doctorUserId: string,
    patientUserId: string,
    intent: ShareRecordsIntent,
    doctorMessage: string,
  ): Promise<void> {
    const docs = await this.medicalDocRepo.find({
      where: { patient_id: patientUserId },
      order: { created_at: 'ASC' },
    });
    if (!docs.length) return;

    const needle = doctorMessage.trim().toLowerCase();
    const toShare: MedicalDocument[] = [];

    if (intent === 'lab' || intent === 'all') {
      const lab = this.pickDocumentForShare(docs, DocumentType.LAB, needle);
      if (lab) toShare.push(lab);
    }
    if (intent === 'xray' || intent === 'all') {
      const xray = this.pickDocumentForShare(docs, DocumentType.XRAY, needle);
      if (xray && !toShare.some((d) => d.id === xray.id)) toShare.push(xray);
    }

    for (const doc of toShare) {
      const alreadyShared = await this.recentlySharedRecord(
        patientUserId,
        doctorUserId,
        doc.id,
      );
      if (alreadyShared) continue;

      await this.postMedicalLinkMessage(doctorUserId, patientUserId, doc);
      await this.delay(350);
    }
  }

  private pickDocumentForShare(
    docs: MedicalDocument[],
    type: DocumentType,
    needle: string,
  ): MedicalDocument | null {
    const matches = docs.filter((d) => d.type === type);
    if (!matches.length) return null;

    const titleHit = matches.find(
      (d) =>
        needle.includes(d.title.toLowerCase()) ||
        d.title.toLowerCase().split(/\s+/).some((word) => word.length > 3 && needle.includes(word)),
    );
    return titleHit ?? matches[0];
  }

  private async recentlySharedRecord(
    patientUserId: string,
    doctorUserId: string,
    recordId: string,
  ): Promise<boolean> {
    const recent = await this.messageRepo
      .createQueryBuilder('m')
      .where('m.type = :type', { type: 'medical_link' })
      .andWhere('m.creator = :patient', { patient: patientUserId })
      .andWhere('m.recipient = :doctor', { doctor: doctorUserId })
      .orderBy('m.datetime', 'DESC')
      .take(12)
      .getMany();

    return recent.some(
      (row) =>
        (row.attachment_meta as { record_id?: string } | null)?.record_id === recordId,
    );
  }

  private async postMedicalLinkMessage(
    doctorUserId: string,
    patientUserId: string,
    doc: MedicalDocument,
  ): Promise<void> {
    const recordType = doc.type === DocumentType.XRAY ? 'xray' : 'lab';
    const title = doc.title?.trim() || (recordType === 'xray' ? 'Imaging result' : 'Lab result');
    const patientName = DEFAULT_TEST_PATIENT_DISPLAY_NAME;
    const summary =
      recordType === 'xray'
        ? `${patientName} shared an X-ray / scan`
        : `${patientName} shared a lab result`;

    const created = this.messageRepo.create({
      type: 'medical_link',
      content: summary,
      creator: patientUserId,
      recipient: doctorUserId,
      attachment_url: null,
      attachment_meta: {
        record_type: recordType,
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
      peer_name: patientName,
    });
    this.presence.emitToUser(patientUserId, 'message:new', {
      message: mapped,
      peer_id: doctorUserId,
    });

    try {
      await this.pushNotifications.sendChatMessage({
        recipientId: doctorUserId,
        chatId: patientUserId,
        messageId: saved.id,
        senderId: patientUserId,
        senderName: patientName,
        body: summary,
      });
    } catch (err) {
      this.logger.error('Failed to push demo patient medical link', err);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async buildPatientContext(
    patientUserId: string,
    doctorUserId?: string,
  ): Promise<{
    specialityName: string;
    historySummary: string;
  }> {
    const testRow = await this.testAccountRepo.findOne({
      where: { patient_user_id: patientUserId },
    });
    let specialityName = 'General Medicine';
    if (testRow?.speciality_id) {
      const spec = await this.specialityRepo.findOne({
        where: { id: testRow.speciality_id },
      });
      if (spec?.name_en) specialityName = spec.name_en;
    } else if (doctorUserId) {
      const doctor = await this.doctorRepo.findOne({ where: { user_id: doctorUserId } });
      if (doctor?.speciality_id) {
        const spec = await this.specialityRepo.findOne({
          where: { id: doctor.speciality_id },
        });
        if (spec?.name_en) specialityName = spec.name_en;
      }
    }

    const seeds = seedsForSpeciality(specialityName);
    const docs = await this.medicalDocRepo.find({
      where: { patient_id: patientUserId },
      order: { created_at: 'ASC' },
    });

    const lines = docs.length
      ? docs.map(
          (d) =>
            `- ${d.title} (${d.type}${d.body_part ? `, ${d.body_part}` : ''}): ${d.notes ?? seeds.find((s) => s.title === d.title)?.notes ?? 'on file'}`,
        )
      : seeds.map((s) => `- ${s.title} (${s.type}): ${s.notes}`);

    return {
      specialityName,
      historySummary: lines.join('\n'),
    };
  }

  private async loadChatHistory(doctorUserId: string, patientUserId: string) {
    const rows = await this.messageRepo
      .createQueryBuilder('m')
      .where(
        '(m.creator = :doctor AND m.recipient = :patient) OR (m.creator = :patient AND m.recipient = :doctor)',
        { doctor: doctorUserId, patient: patientUserId },
      )
      .andWhere('m.type = :type', { type: 'text' })
      .andWhere('m.content != :welcome', { welcome: TEST_PATIENT_WELCOME_MESSAGE })
      .orderBy('m.datetime', 'DESC')
      .take(CHAT_HISTORY_LIMIT)
      .getMany();

    return rows
      .reverse()
      .map((row) => ({
        role: (row.creator === doctorUserId ? 'user' : 'assistant') as
          | 'user'
          | 'assistant',
        content: row.content,
      }));
  }

  async assertSenderIsDoctor(userId: string): Promise<boolean> {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      select: { role: true },
    });
    return user?.role === UserRole.DOCTOR;
  }
}
