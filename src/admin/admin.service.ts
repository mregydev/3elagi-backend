import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository, EntityMetadataNotFoundError } from 'typeorm';
import { User, UserRole } from '../entities/user.entity';
import { Doctor, ApprovalStatus } from '../entities/doctor.entity';
import { Clinic } from '../entities/clinic.entity';
import { PatientProfile } from '../entities/patient-profile.entity';
import { AdminRagSource } from '../entities/admin-rag-source.entity';
import {
  IntakeTest,
  IntakeQuestion,
} from '../entities/intake-test.entity';
import { IntakeTestsService } from '../intake-tests/intake-tests.service';
import { KnowledgeIndexerService } from '../ai/knowledge-indexer.service';
import { PresenceGateway } from '../presence/presence.gateway';
import { PushNotificationsService } from '../push-notifications/push-notifications.service';
import { SpecialitiesService } from '../specialities/specialities.service';
import { UploadsService } from '../uploads/uploads.service';
import { MailService } from '../mail/mail.service';
import type { SendMarketingEmailDto } from './dto/send-marketing-email.dto';
import type { SendMarketingEmailBatchDto } from './dto/send-marketing-email-batch.dto';
import {
  compileMarketingSections,
  getDefaultMarketingSections,
} from '../mail/marketing-email-sections';
import type { MarketingEmailSection } from '../mail/marketing-email-sections';
import {
  buildMarketingEmailHtml,
  getMarketingTemplatePreview,
  marketingEmailLogoAttachments,
} from '../mail/marketing-email.template';
import {
  buildDoctorWelcomeEmailHtml,
  getDoctorWelcomeTemplatePreview,
} from '../mail/doctor-welcome-email.template';
import {
  buildInvitedDoctorEmailHtml,
  getInvitedDoctorTemplatePreview,
} from '../mail/invited-doctor-email.template';
import { resolveMarketingEmailTheme } from '../mail/marketing-email-themes';
import { DoctorOnboardingService } from '../doctor-onboarding/doctor-onboarding.service';
import { AuthService } from '../auth/auth.service';
import { CreateAdminDoctorDto } from './dto/create-admin-doctor.dto';
import { AccountDeletionService } from '../account-deletion/account-deletion.service';
import { UserAnalyticsService } from '../analytics/user-analytics.service';

const APPROVAL_VALUES: ApprovalStatus[] = ['pending', 'approved', 'rejected'];

interface UpdateDoctorDto {
  name?: string;
  phone?: string;
  country?: string;
  age?: number;
  email?: string;
  photo_url?: string;
  professional_title?: string | null;
  description?: string | null;
  experience_years?: number | null;
  consultation_fee_egp?: number | null;
}

interface UpdatePatientDto {
  name?: string;
  phone?: string;
  country?: string;
  birth_date?: string | null;
  gender?: string | null;
  chronic_conditions?: string | null;
  allergies?: string | null;
  medical_notes?: string | null;
  photo_url?: string | null;
}

interface UpsertDefaultIntakeDto {
  name: string;
  description?: string;
  is_active?: boolean;
  questions: IntakeQuestion[];
}

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Doctor) private doctorRepo: Repository<Doctor>,
    @InjectRepository(Clinic) private clinicRepo: Repository<Clinic>,
    @InjectRepository(PatientProfile)
    private patientRepo: Repository<PatientProfile>,
    @InjectRepository(AdminRagSource)
    private ragSourceRepo: Repository<AdminRagSource>,
    @InjectRepository(IntakeTest) private intakeRepo: Repository<IntakeTest>,
    private intakeService: IntakeTestsService,
    private knowledgeIndexer: KnowledgeIndexerService,
    private presenceGateway: PresenceGateway,
    private pushNotifications: PushNotificationsService,
    private specialitiesService: SpecialitiesService,
    private uploadsService: UploadsService,
    private mailService: MailService,
    private doctorOnboarding: DoctorOnboardingService,
    private authService: AuthService,
    private accountDeletion: AccountDeletionService,
    private userAnalytics: UserAnalyticsService,
  ) {}

  // ----- Specialities (market visibility) -----
  listSpecialities() {
    return this.specialitiesService.findAllForAdmin();
  }

  updateSpecialityVisibility(
    id: string,
    patch: { visible_eg?: boolean; visible_jo?: boolean },
  ) {
    return this.specialitiesService.updateVisibility(id, patch);
  }

  // ----- Doctors -----
  listDoctors() {
    return this.doctorRepo.find({
      relations: ['speciality'],
      order: { created_at: 'DESC' },
    });
  }

  /** Admin-created doctors skip the pending queue and go live immediately. */
  async createDoctor(dto: CreateAdminDoctorDto) {
    const result = await this.authService.registerDoctor(dto, 'web', {
      autoApprove: true,
    });
    const profile = result.body.profile as Doctor | undefined;
    const doctorId =
      profile?.id ??
      (
        await this.doctorRepo.findOne({
          where: { user_id: result.body.user_id as string },
        })
      )?.id;
    if (!doctorId) {
      throw new BadRequestException('Doctor account was created but could not be loaded');
    }
    await this.setDoctorApproval(doctorId, 'approved');
    const approved = await this.doctorRepo.findOne({
      where: { id: doctorId },
      relations: ['speciality'],
    });

    let welcomeEmail: { ok: boolean; error?: string } | undefined;
    if (dto.send_welcome_email) {
      try {
        await this.sendDoctorWelcomeEmailOnCreate({
          name: dto.name.trim(),
          email: dto.email.trim().toLowerCase(),
          password: dto.password,
          language: dto.welcome_email_language ?? 'en',
          themeColor: dto.welcome_email_theme,
          sections: dto.welcome_email_sections as MarketingEmailSection[] | undefined,
        });
        welcomeEmail = { ok: true };
      } catch (err) {
        welcomeEmail = {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }

    return {
      ...result.body,
      profile: approved ?? profile,
      access_token: result.tokens.accessToken,
      refresh_token: result.tokens.refreshToken,
      welcome_email: welcomeEmail,
    };
  }

  async updateDoctor(id: string, dto: UpdateDoctorDto) {
    const doc = await this.doctorRepo.findOne({ where: { id } });
    if (!doc) throw new NotFoundException('Doctor not found');
    const safe: Partial<Doctor> = {};
    if (dto.name !== undefined) safe.name = dto.name;
    if (dto.phone !== undefined) safe.phone = dto.phone;
    if (dto.country !== undefined) {
      safe.country = dto.country.trim().toUpperCase();
    }
    if (dto.age !== undefined) safe.age = dto.age;
    if (dto.email !== undefined) safe.email = dto.email;
    if (dto.photo_url !== undefined) safe.photo_url = dto.photo_url;
    if (dto.professional_title !== undefined) safe.professional_title = dto.professional_title;
    if (dto.description !== undefined) safe.description = dto.description;
    if (dto.experience_years !== undefined) safe.experience_years = dto.experience_years;
    if (dto.consultation_fee_egp !== undefined) safe.consultation_fee_egp = dto.consultation_fee_egp;
    if (Object.keys(safe).length) await this.doctorRepo.update(id, safe);
    if (dto.email !== undefined && doc.user_id) {
      await this.userRepo.update(doc.user_id, { email: dto.email });
    }
    return this.doctorRepo.findOne({ where: { id } });
  }

  async setDoctorApproval(id: string, status: ApprovalStatus) {
    if (!APPROVAL_VALUES.includes(status)) {
      throw new BadRequestException('Invalid approval status');
    }
    const doc = await this.doctorRepo.findOne({ where: { id } });
    if (!doc) throw new NotFoundException('Doctor not found');
    await this.doctorRepo.update(id, { approval_status: status });
    // Personal clinic of this doctor mirrors approval.
    if (doc.default_clinic_id) {
      await this.clinicRepo.update(
        { id: doc.default_clinic_id, is_personal: true },
        { approval_status: status },
      );
    }
    void this.knowledgeIndexer.indexDoctor(id).catch(() => undefined);
    if (status === 'approved') {
      void this.specialitiesService.buildDoctorRosterPayload(id).then((payload) => {
        if (payload) this.presenceGateway.broadcastDoctorRegistered(payload);
      });
      void this.doctorOnboarding.setupDoctorOnboarding(id).catch(() => undefined);
    }
    return this.doctorRepo.findOne({ where: { id } });
  }

  // ----- Clinics -----
  listClinics() {
    return this.clinicRepo.find({ order: { name: 'ASC' } });
  }

  async setClinicApproval(id: string, status: ApprovalStatus) {
    if (!APPROVAL_VALUES.includes(status)) {
      throw new BadRequestException('Invalid approval status');
    }
    const c = await this.clinicRepo.findOne({ where: { id } });
    if (!c) throw new NotFoundException('Clinic not found');
    await this.clinicRepo.update(id, { approval_status: status });
    return this.clinicRepo.findOne({ where: { id } });
  }

  async deleteDoctor(id: string) {
    await this.accountDeletion.deleteDoctorAccount(id, 'admin');
    return { ok: true };
  }

  // ----- Patients -----
  listPatients() {
    return this.patientRepo.find({ order: { name: 'ASC' } });
  }

  async updatePatient(userId: string, dto: UpdatePatientDto) {
    const p = await this.patientRepo.findOne({ where: { user_id: userId } });
    if (!p) throw new NotFoundException('Patient not found');
    const safe: Partial<PatientProfile> = {};
    if (dto.name !== undefined) safe.name = dto.name;
    if (dto.phone !== undefined) safe.phone = dto.phone;
    if (dto.country !== undefined) {
      safe.country = dto.country.trim().toUpperCase();
    }
    if (dto.birth_date !== undefined) safe.birth_date = dto.birth_date;
    if (dto.gender !== undefined) safe.gender = dto.gender;
    if (dto.chronic_conditions !== undefined)
      safe.chronic_conditions = dto.chronic_conditions;
    if (dto.allergies !== undefined) safe.allergies = dto.allergies;
    if (dto.medical_notes !== undefined) safe.medical_notes = dto.medical_notes;
    if (dto.photo_url !== undefined) safe.photo_url = dto.photo_url;
    await this.patientRepo.update(userId, safe);
    return this.patientRepo.findOne({ where: { user_id: userId } });
  }

  async deletePatient(userId: string) {
    await this.accountDeletion.deletePatientAccount(userId, 'admin');
    return { ok: true };
  }

  listDeletedAccounts() {
    return this.accountDeletion.listDeletedAccounts();
  }

  async listLoginAnalytics() {
    try {
      return await this.userAnalytics.listLoginStats();
    } catch (err) {
      if (err instanceof EntityMetadataNotFoundError) {
        return [];
      }
      throw err;
    }
  }

  async getMarketingTemplate(
    language: SendMarketingEmailDto['language'],
    theme?: SendMarketingEmailDto['themeColor'],
  ) {
    return getMarketingTemplatePreview(language, theme);
  }

  previewMarketingEmail(dto: {
    language: SendMarketingEmailDto['language'];
    themeColor?: SendMarketingEmailDto['themeColor'];
    previewName?: string;
    sections: MarketingEmailSection[];
  }) {
    const themeColor = resolveMarketingEmailTheme(dto.themeColor);
    const name = dto.previewName?.trim() || 'Doctor';
    const { subject, html } = buildMarketingEmailHtml(
      dto.language,
      name,
      undefined,
      themeColor,
      dto.sections,
      true,
    );
    return {
      subject,
      html,
      dir: dto.language === 'ar' ? ('rtl' as const) : ('ltr' as const),
      themeColor,
    };
  }

  getDoctorWelcomeTemplate(
    language: SendMarketingEmailDto['language'],
    theme?: SendMarketingEmailDto['themeColor'],
  ) {
    return getDoctorWelcomeTemplatePreview(language, theme);
  }

  previewDoctorWelcomeEmail(dto: {
    language: SendMarketingEmailDto['language'];
    themeColor?: SendMarketingEmailDto['themeColor'];
    previewName?: string;
    previewEmail?: string;
    previewPassword?: string;
    sections: MarketingEmailSection[];
  }) {
    const themeColor = resolveMarketingEmailTheme(dto.themeColor);
    const { subject, html, text } = buildDoctorWelcomeEmailHtml({
      language: dto.language,
      theme: themeColor,
      sections: dto.sections,
      placeholders: {
        name: dto.previewName?.trim() || 'Doctor',
        email: dto.previewEmail?.trim() || 'doctor@example.com',
        password: dto.previewPassword?.trim() || 'YourPassword123',
      },
      forPreview: true,
    });
    return {
      subject,
      html,
      text,
      dir: dto.language === 'ar' ? ('rtl' as const) : ('ltr' as const),
      themeColor,
    };
  }

  getInvitedDoctorTemplate(
    language: SendMarketingEmailDto['language'],
    theme?: SendMarketingEmailDto['themeColor'],
  ) {
    return getInvitedDoctorTemplatePreview(language, theme);
  }

  previewInvitedDoctorEmail(dto: {
    language: SendMarketingEmailDto['language'];
    themeColor?: SendMarketingEmailDto['themeColor'];
    name?: string;
    email?: string;
    password?: string;
    sections: MarketingEmailSection[];
  }) {
    const themeColor = resolveMarketingEmailTheme(dto.themeColor);
    const { subject, html, text } = buildInvitedDoctorEmailHtml({
      language: dto.language,
      theme: themeColor,
      sections: dto.sections,
      placeholders: {
        name: dto.name?.trim() || 'Doctor',
        email: dto.email?.trim() || 'doctor@example.com',
        password: dto.password?.trim() || 'YourPassword123',
      },
      forPreview: true,
    });
    return {
      subject,
      html,
      text,
      dir: dto.language === 'ar' ? ('rtl' as const) : ('ltr' as const),
      themeColor,
    };
  }

  async sendInvitedDoctorEmail(dto: {
    name: string;
    email: string;
    password: string;
    language: SendMarketingEmailDto['language'];
    themeColor?: SendMarketingEmailDto['themeColor'];
    sections: MarketingEmailSection[];
  }) {
    const name = dto.name.trim();
    const email = dto.email.trim().toLowerCase();
    if (!name || !email) {
      throw new BadRequestException('Doctor name and email are required');
    }
    const { subject, html, text } = buildInvitedDoctorEmailHtml({
      language: dto.language,
      theme: dto.themeColor,
      sections: dto.sections,
      placeholders: {
        name,
        email,
        password: dto.password,
      },
    });
    await this.mailService.sendDoctorMarketingInvite({
      to: email,
      recipientName: name,
      subject,
      text,
      html,
      attachments: marketingEmailLogoAttachments(),
    });
    return { ok: true, email };
  }

  async sendDoctorWelcomeEmail(dto: {
    name: string;
    email: string;
    password: string;
    language: SendMarketingEmailDto['language'];
    themeColor?: SendMarketingEmailDto['themeColor'];
    sections: MarketingEmailSection[];
  }) {
    const name = dto.name.trim();
    const email = dto.email.trim().toLowerCase();
    if (!name || !email) {
      throw new BadRequestException('Doctor name and email are required');
    }
    const { subject, html, text } = buildDoctorWelcomeEmailHtml({
      language: dto.language,
      theme: dto.themeColor,
      sections: dto.sections,
      placeholders: {
        name,
        email,
        password: dto.password,
      },
    });
    await this.mailService.sendDoctorMarketingInvite({
      to: email,
      recipientName: name,
      subject,
      text,
      html,
      attachments: marketingEmailLogoAttachments(),
    });
    return { ok: true, email };
  }

  private async sendDoctorWelcomeEmailOnCreate(input: {
    name: string;
    email: string;
    password: string;
    language: SendMarketingEmailDto['language'];
    themeColor?: SendMarketingEmailDto['themeColor'];
    sections?: MarketingEmailSection[];
  }) {
    const { subject, html, text } = buildDoctorWelcomeEmailHtml({
      language: input.language,
      theme: input.themeColor,
      sections: input.sections,
      placeholders: {
        name: input.name,
        email: input.email,
        password: input.password,
      },
    });
    await this.mailService.sendDoctorMarketingInvite({
      to: input.email,
      recipientName: input.name,
      subject,
      text,
      html,
      attachments: marketingEmailLogoAttachments(),
    });
  }

  async sendMarketingEmail(dto: SendMarketingEmailDto) {
    const email = dto.email.trim().toLowerCase();
    const name = dto.name.trim();
    if (!email || !name) {
      throw new BadRequestException('Recipient name and email are required');
    }

    return this.sendOneMarketingEmail({
      name,
      email,
      language: dto.language,
      bodyHtml: dto.bodyHtml,
      themeColor: dto.themeColor,
    });
  }

  async sendMarketingEmailBatch(dto: SendMarketingEmailBatchDto) {
    const themeColor = resolveMarketingEmailTheme(dto.themeColor);
    const bodyHtml = this.resolveMarketingBodyHtml(dto, themeColor);
    if (!bodyHtml) {
      throw new BadRequestException('Email body cannot be empty');
    }

    const seen = new Set<string>();
    const uniqueRecipients: { name: string; email: string }[] = [];
    for (const recipient of dto.recipients) {
      const email = recipient.email.trim().toLowerCase();
      const name = recipient.name.trim();
      if (!email || !name || seen.has(email)) continue;
      seen.add(email);
      uniqueRecipients.push({ email, name });
    }

    if (!uniqueRecipients.length) {
      throw new BadRequestException('At least one valid recipient is required');
    }

    const results: Array<{
      email: string;
      name: string;
      ok: boolean;
      error?: string;
    }> = [];

    for (const recipient of uniqueRecipients) {
      try {
        await this.sendOneMarketingEmail({
          name: recipient.name,
          email: recipient.email,
          language: dto.language,
          bodyHtml,
          sections: dto.sections as MarketingEmailSection[] | undefined,
          themeColor,
        });
        results.push({
          email: recipient.email,
          name: recipient.name,
          ok: true,
        });
      } catch (err) {
        results.push({
          email: recipient.email,
          name: recipient.name,
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const sent = results.filter((row) => row.ok).length;
    const failed = results.length - sent;

    return {
      ok: failed === 0,
      sent,
      failed,
      total: results.length,
      language: dto.language,
      themeColor,
      results,
    };
  }

  private resolveMarketingBodyHtml(
    dto: {
      language: SendMarketingEmailDto['language'];
      bodyHtml?: string;
      sections?: MarketingEmailSection[];
    },
    themeColor: ReturnType<typeof resolveMarketingEmailTheme>,
  ): string {
    if (dto.sections?.length) {
      return compileMarketingSections(
        dto.sections,
        dto.language,
        themeColor,
      ).trim();
    }
    const trimmed = dto.bodyHtml?.trim();
    if (trimmed) return trimmed;
    return compileMarketingSections(
      getDefaultMarketingSections(dto.language),
      dto.language,
      themeColor,
    ).trim();
  }

  private async sendOneMarketingEmail(input: {
    name: string;
    email: string;
    language: SendMarketingEmailDto['language'];
    bodyHtml?: string;
    sections?: MarketingEmailSection[];
    themeColor?: SendMarketingEmailDto['themeColor'];
  }) {
    const { subject, html, text } = buildMarketingEmailHtml(
      input.language,
      input.name,
      input.bodyHtml,
      input.themeColor,
      input.sections,
    );
    await this.mailService.sendDoctorMarketingInvite({
      to: input.email,
      recipientName: input.name,
      subject,
      text,
      html,
      attachments: marketingEmailLogoAttachments(),
    });

    return {
      ok: true,
      to: input.email,
      language: input.language,
      themeColor: resolveMarketingEmailTheme(input.themeColor),
      subject,
    };
  }

  async sendNotf() {
    const recipients = await this.userRepo.find({
      select: { id: true, role: true },
      where: {
        role: In([UserRole.DOCTOR, UserRole.PATIENT]),
      },
    });

    const title = '3elagi';
    const body = 'This is a test notification';

    await Promise.all(
      recipients.map(async (user) => {
        this.presenceGateway.emitToUser(user.id, 'system:notification', {
          title,
          body,
        });
        await this.pushNotifications.sendSystemNotification({
          recipientId: user.id,
          title,
          body,
        });
      }),
    );

    return {
      ok: true,
      recipients: recipients.length,
      message: body,
    };
  }

  // ----- Default intake template -----
  async getDefaultIntake(): Promise<IntakeTest | null> {
    return this.intakeRepo.findOne({
      where: { is_default_template: true },
    });
  }

  async upsertDefaultIntake(dto: UpsertDefaultIntakeDto): Promise<IntakeTest> {
    if (!dto?.name || !dto.name.trim()) {
      throw new BadRequestException('Test name is required');
    }
    const questions = this.intakeService.normalizeQuestions(dto.questions);
    const existing = await this.intakeRepo.findOne({
      where: { is_default_template: true },
    });
    if (existing) {
      existing.name = dto.name.trim();
      existing.description =
        typeof dto.description === 'string'
          ? dto.description.trim() || null
          : null;
      existing.is_active = dto.is_active !== false;
      existing.questions = questions;
      return this.intakeRepo.save(existing);
    }
    const created = this.intakeRepo.create({
      doctor_id: null,
      is_default_template: true,
      name: dto.name.trim(),
      description:
        typeof dto.description === 'string'
          ? dto.description.trim() || null
          : null,
      is_active: dto.is_active !== false,
      questions,
    });
    return this.intakeRepo.save(created);
  }

  // ----- Admin RAG sources -----
  async listRagSources() {
    const rows = await this.ragSourceRepo.find({
      order: { created_at: 'DESC' },
    });
    return rows.map((row) => this.mapRagSource(row));
  }

  async createRagText(
    actorUserId: string,
    dto: { title?: string; content?: string },
  ) {
    const content = dto.content?.trim();
    if (!content) {
      throw new BadRequestException('Text content is required');
    }
    const title = this.normalizeTitle(dto.title, content, 'Text knowledge');
    const source = await this.ragSourceRepo.save(
      this.ragSourceRepo.create({
        kind: 'text',
        title,
        content,
        created_by: actorUserId,
      }),
    );
    try {
      await this.knowledgeIndexer.indexAdminKnowledge(
        source.id,
        source.title,
        source.content,
        {
          kind: source.kind,
          title: source.title,
        },
      );
    } catch (err) {
      await this.ragSourceRepo.delete(source.id);
      throw new BadRequestException(
        err instanceof Error
          ? err.message
          : 'Failed to train AI on this text. Check embeddings configuration.',
      );
    }
    return this.mapRagSource(source);
  }

  async createRagDocument(
    actorUserId: string,
    dto: {
      title?: string;
      file_url?: string;
      file_name?: string;
      mime_type?: string;
    },
  ) {
    const fileUrl = dto.file_url?.trim();
    if (!fileUrl) {
      throw new BadRequestException(
        'file_url is required. Use document/train to train without storing the file.',
      );
    }

    const fileName = dto.file_name?.trim() || 'document';
    const mimeType = this.detectDocumentMime(dto.mime_type, fileName);
    if (!mimeType) {
      throw new BadRequestException('Only PDF and DOCX documents are supported');
    }

    const buffer = await this.uploadsService.getBufferFromUrl(fileUrl);
    if (!buffer?.length) {
      throw new BadRequestException('Could not read uploaded file');
    }

    return this.trainRagDocument(actorUserId, buffer, {
      title: dto.title,
      file_name: fileName,
      mime_type: mimeType,
    });
  }

  async trainRagDocument(
    actorUserId: string,
    buffer: Buffer,
    dto: {
      title?: string;
      file_name?: string;
      mime_type?: string;
    },
  ) {
    const fileName = dto.file_name?.trim() || 'document';
    const mimeType = this.detectDocumentMime(dto.mime_type, fileName);
    if (!mimeType) {
      throw new BadRequestException('Only PDF and DOCX documents are supported');
    }

    const extracted = await this.extractDocumentText(buffer, mimeType);
    const content = this.sanitizeUtf8Text(extracted).trim();
    if (!content) {
      throw new BadRequestException('No readable text found in the document');
    }

    const title = this.normalizeTitle(dto.title, fileName, fileName);
    const source = await this.ragSourceRepo.save(
      this.ragSourceRepo.create({
        kind: 'document',
        title,
        content,
        file_url: null,
        file_name: fileName,
        mime_type: mimeType,
        created_by: actorUserId,
      }),
    );

    try {
      await this.knowledgeIndexer.indexAdminKnowledge(
        source.id,
        source.title,
        source.content,
        {
          kind: source.kind,
          title: source.title,
          fileName: source.file_name,
          mimeType: source.mime_type,
        },
      );
    } catch (err) {
      await this.ragSourceRepo.delete(source.id);
      throw new BadRequestException(
        err instanceof Error
          ? err.message
          : 'Failed to train AI on this document. Check embeddings configuration.',
      );
    }
    return this.mapRagSource(source);
  }

  async trainRagDocumentFromChunk(
    actorUserId: string,
    dto: {
      upload_id: string;
      title?: string;
      file_name?: string;
      mime_type?: string;
    },
  ) {
    const assembled = this.uploadsService.consumeChunkUpload(dto.upload_id);
    return this.trainRagDocument(actorUserId, assembled.buffer, {
      title: dto.title,
      file_name: dto.file_name ?? assembled.filename,
      mime_type: dto.mime_type ?? assembled.mimeType,
    });
  }

  async deleteRagSource(id: string) {
    const row = await this.ragSourceRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('RAG source not found');
    await this.ragSourceRepo.delete(id);
    await this.knowledgeIndexer.deleteAdminKnowledge(id);
    return { ok: true };
  }

  // Used by the auth seed to ensure exactly one admin user exists.
  async ensureAdminUser(repoUser: User | null): Promise<void> {
    void repoUser; // (no-op marker)
  }

  // For audit / counts later.
  async stats() {
    const [doctors, patients] = await Promise.all([
      this.doctorRepo.count(),
      this.patientRepo.count(),
    ]);
    return { doctors, patients };
  }

  ensureAdmin = async (): Promise<void> => {
    const existing = await this.userRepo.findOne({
      where: { role: UserRole.ADMIN },
    });
    if (existing) return;
    // Defer to AuthService for hashing — keep direct here too via bcrypt to avoid cycles.
    const bcrypt = await import('bcryptjs');
    const hash = await bcrypt.hash('admin', 10);
    const u = this.userRepo.create({
      email: 'admin',
      password_hash: hash,
      role: UserRole.ADMIN,
    });
    await this.userRepo.save(u);
  };

  private mapRagSource(row: AdminRagSource) {
    return {
      id: row.id,
      kind: row.kind,
      title: row.title,
      file_url: row.file_url,
      file_name: row.file_name,
      mime_type: row.mime_type,
      created_at: row.created_at,
      preview:
        row.kind === 'text' || !row.file_url
          ? row.content.slice(0, 220)
          : row.file_name ?? row.title,
    };
  }

  private normalizeTitle(
    rawTitle: string | undefined,
    fallbackText: string,
    defaultTitle: string,
  ): string {
    const explicit = rawTitle?.trim();
    if (explicit) return explicit.slice(0, 255);
    const candidate = fallbackText.trim().replace(/\s+/g, ' ').slice(0, 255);
    return candidate || defaultTitle;
  }

  private sanitizeUtf8Text(text: string): string {
    return text.replace(/\u0000/g, '');
  }

  private detectDocumentMime(
    rawMime: string | undefined,
    fileName: string,
  ): string | null {
    const mime = rawMime?.trim().toLowerCase() ?? '';
    if (mime === 'application/pdf') return mime;
    if (
      mime ===
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ) {
      return mime;
    }

    const lower = fileName.toLowerCase();
    if (lower.endsWith('.pdf')) return 'application/pdf';
    if (lower.endsWith('.docx')) {
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    }
    return null;
  }

  private async extractDocumentText(
    buffer: Buffer,
    mimeType: string,
  ): Promise<string> {
    if (mimeType === 'application/pdf') {
      const mod = await import('pdf-parse');
      const parser = new mod.PDFParse({ data: buffer });
      try {
        const parsed = await parser.getText();
        return parsed.text ?? '';
      } finally {
        await parser.destroy().catch(() => undefined);
      }
    }

    const mammoth = await import('mammoth');
    const parsed = await mammoth.extractRawText({ buffer });
    return parsed.value ?? '';
  }
}
