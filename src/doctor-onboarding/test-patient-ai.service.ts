import {
  BadRequestException,
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
import { DoctorPatientAccess } from '../entities/doctor-patient-access.entity';
import { MedicalDocument } from '../entities/medical-document.entity';
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

const CHAT_HISTORY_LIMIT = 24;

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
    @InjectRepository(DoctorPatientAccess)
    private accessRepo: Repository<DoctorPatientAccess>,
    @InjectRepository(DoctorSpeciality)
    private specialityRepo: Repository<DoctorSpeciality>,
    @InjectRepository(MedicalDocument)
    private medicalDocRepo: Repository<MedicalDocument>,
    @InjectRepository(User) private userRepo: Repository<User>,
    @Inject(LLM_PROVIDER) private readonly llm: LlmProvider,
    private presence: PresenceGateway,
    private pushNotifications: PushNotificationsService,
    private users: UsersService,
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

    const doctor = await this.doctorRepo.findOne({ where: { user_id: doctorUserId } });
    if (!doctor) return;

    let access = await this.accessRepo.findOne({
      where: { patient_user_id: patientUserId, doctor_id: doctor.id },
    });
    if (!access) {
      access = await this.accessRepo.save(
        this.accessRepo.create({
          patient_user_id: patientUserId,
          doctor_id: doctor.id,
          records_allowed: true,
          records_allowed_at: new Date(),
          blocked_by_patient: false,
          blocked_by_doctor: false,
        }),
      );
    } else if (!access.records_allowed) {
      access.records_allowed = true;
      access.records_allowed_at = new Date();
      await this.accessRepo.save(access);
    }

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
    const row = await this.testAccountRepo.findOne({
      where: { speciality_id: doctor.speciality_id },
    });
    return row?.patient_user_id ?? null;
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

    const context = await this.buildPatientContext(patientUserId);
    const history = await this.loadChatHistory(doctorUserId, patientUserId);

    const systemPrompt = [
      `You are role-playing as "${DEFAULT_TEST_PATIENT_DISPLAY_NAME}", a simulated patient on the 3elagi telemedicine platform.`,
      `The consulting doctor's specialty context is: ${context.specialityName}.`,
      'Answer as a realistic patient in first person. Be concise (usually under 120 words).',
      'Base answers on the medical history below. Invent plausible symptom details that fit the records if needed.',
      'Never say you are an AI, a bot, or a test account.',
      'If the doctor asks for labs or imaging, say you will share what you have on file.',
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
  }

  private async buildPatientContext(patientUserId: string): Promise<{
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
