import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes, randomInt } from 'crypto';
import { User, UserRole } from '../entities/user.entity';
import { Clinic } from '../entities/clinic.entity';
import { Doctor } from '../entities/doctor.entity';
import { DoctorSpeciality } from '../entities/doctor-speciality.entity';
import { PatientProfile } from '../entities/patient-profile.entity';
import { LoginDto } from './dto/login.dto';
import { RegisterClinicDto } from './dto/register-clinic.dto';
import { RegisterDoctorDto } from './dto/register-doctor.dto';
import { RegisterPatientDto } from './dto/register-patient.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { DEFAULT_MESSAGE_POINTS } from '../points/points.constants';
import type { GoogleIdentity } from './google-oauth.service';
import { defaultDoctorFeeColumns } from '../doctors/doctor-fees';
import { clampConsultationPrice } from '../points/message-price.constants';
import { PresenceGateway } from '../presence/presence.gateway';
import { SpecialitiesService } from '../specialities/specialities.service';
import { MailService } from '../mail/mail.service';

const VERIFICATION_TTL_MS = 15 * 60 * 1000;
const RESET_TTL_MS = 60 * 60 * 1000;

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Clinic) private clinicRepo: Repository<Clinic>,
    @InjectRepository(Doctor) private doctorRepo: Repository<Doctor>,
    @InjectRepository(DoctorSpeciality)
    private specialityRepo: Repository<DoctorSpeciality>,
    @InjectRepository(PatientProfile)
    private patientProfileRepo: Repository<PatientProfile>,
    private jwtService: JwtService,
    private presenceGateway: PresenceGateway,
    private specialitiesService: SpecialitiesService,
    private mailService: MailService,
    private config: ConfigService,
  ) {}

  private async broadcastDoctorListed(doctorId: string): Promise<void> {
    const payload = await this.specialitiesService.buildDoctorRosterPayload(doctorId);
    if (payload) {
      this.presenceGateway.broadcastDoctorRegistered(payload);
    }
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private isEmailVerified(user: User): boolean {
    return !!user.email_verified_at;
  }

  private generateVerificationCode(): string {
    return String(randomInt(0, 10000)).padStart(4, '0');
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private async issueVerificationCode(user: User): Promise<string> {
    const code = this.generateVerificationCode();
    user.email_verification_code_hash = await bcrypt.hash(code, 10);
    user.email_verification_expires_at = new Date(Date.now() + VERIFICATION_TTL_MS);
    await this.userRepo.save(user);
    await this.mailService.sendVerificationCode(user.email, code);
    return code;
  }

  private async buildAuthResponse(user: User) {
    const payload = { sub: user.id, email: user.email, role: user.role };
    const token = this.jwtService.sign(payload);

    let profile: Clinic | Doctor | PatientProfile | null = null;
    if (user.role === UserRole.CLINIC_ADMIN) {
      profile = await this.clinicRepo.findOne({ where: { owner_id: user.id } });
    } else if (user.role === UserRole.DOCTOR) {
      profile = await this.doctorRepo.findOne({
        where: { user_id: user.id },
        relations: ['speciality'],
      });
    } else if (user.role === UserRole.PATIENT) {
      profile = await this.patientProfileRepo.findOne({
        where: { user_id: user.id },
      });
    }

    return {
      access_token: token,
      role: user.role,
      user_id: user.id,
      profile,
      preferred_locale: user.preferred_locale,
      email_verified: this.isEmailVerified(user),
    };
  }

  private appWebUrl(): string {
    return (
      this.config.get<string>('APP_WEB_URL')?.trim().replace(/\/$/, '') ||
      'http://localhost:8081'
    );
  }

  async login(dto: LoginDto) {
    const email = this.normalizeEmail(dto.email);
    const user = await this.userRepo.findOne({ where: { email } });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(dto.password, user.password_hash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    return this.buildAuthResponse(user);
  }

  /**
   * Google sign-in: an existing account with that email is signed in, a new one
   * is created as a patient. No password is set — these users sign in only
   * through Google, and `login()` rejects them because bcrypt cannot match an
   * unusable hash.
   */
  async signInWithGoogle(
    identity: GoogleIdentity,
    consent?: { medicalRecordsStorage?: boolean },
  ) {
    if (!identity.emailVerified) {
      throw new UnauthorizedException('Google account email is not verified');
    }
    const email = this.normalizeEmail(identity.email);
    const existing = await this.userRepo.findOne({ where: { email } });
    if (existing) return this.buildAuthResponse(existing);

    // Unknown email: never sign in, and never create an account as a side
    // effect of a *login*. Only the signup flow — which sends the GDPR consent
    // — may create one; everyone else is sent to sign up.
    if (consent?.medicalRecordsStorage !== true) {
      // The verified name/email go back so the client can prefill signup and
      // let the user finish registering the normal way.
      throw new ForbiddenException({
        code: 'ACCOUNT_NOT_FOUND',
        message: 'No 3elagi account is linked to this Google email',
        email,
        name: identity.name,
      });
    }

    const user = this.userRepo.create({
      email,
      // Random, never shared: the account has no password to sign in with.
      password_hash: await bcrypt.hash(randomBytes(32).toString('hex'), 10),
      role: UserRole.PATIENT,
      photo_url: identity.picture,
      preferred_locale: 'ar',
      message_points: DEFAULT_MESSAGE_POINTS,
      points_spent_total: 0,
      points_purchased_total: 0,
      email_verified_at: new Date(),
    });
    await this.userRepo.save(user);

    const profile = this.patientProfileRepo.create({
      user_id: user.id,
      name: identity.name ?? email.split('@')[0],
      photo_url: identity.picture,
      medical_records_storage_consent: true,
      medical_records_storage_consent_at: new Date(),
    });
    await this.patientProfileRepo.save(profile);

    return this.buildAuthResponse(user);
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ) {
    if (typeof newPassword !== 'string' || newPassword.length < 4) {
      throw new UnauthorizedException('New password must be at least 4 characters');
    }
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User not found');
    const valid = await bcrypt.compare(currentPassword || '', user.password_hash);
    if (!valid) throw new UnauthorizedException('Current password is incorrect');
    user.password_hash = await bcrypt.hash(newPassword, 10);
    await this.userRepo.save(user);
    return { ok: true };
  }

  async registerPatient(dto: RegisterPatientDto) {
    const email = this.normalizeEmail(dto.email);
    const existing = await this.userRepo.findOne({ where: { email } });
    if (existing) throw new ConflictException('Email already in use');

    if (!dto.medical_records_storage_consent) {
      throw new BadRequestException('Medical records storage consent is required');
    }

    const hash = await bcrypt.hash(dto.password, 10);
    const user = this.userRepo.create({
      email,
      password_hash: hash,
      role: UserRole.PATIENT,
      photo_url: dto.photo_url ?? null,
      preferred_locale: 'ar',
      message_points: DEFAULT_MESSAGE_POINTS,
      points_spent_total: 0,
      points_purchased_total: 0,
      email_verified_at: new Date(),
    });
    await this.userRepo.save(user);

    const profile = this.patientProfileRepo.create({
      user_id: user.id,
      name: dto.name,
      phone: dto.phone,
      country: dto.country.trim().toUpperCase(),
      photo_url: dto.photo_url ?? null,
      medical_records_storage_consent: true,
      medical_records_storage_consent_at: new Date(),
    });
    await this.patientProfileRepo.save(profile);

    return this.buildAuthResponse(user);
  }

  async registerClinic(dto: RegisterClinicDto) {
    const email = this.normalizeEmail(dto.email);
    const existing = await this.userRepo.findOne({ where: { email } });
    if (existing) throw new ConflictException('Email already in use');

    const hash = await bcrypt.hash(dto.password, 10);
    const user = this.userRepo.create({
      email,
      password_hash: hash,
      role: UserRole.CLINIC_ADMIN,
      photo_url: dto.photo_url ?? null,
      preferred_locale: 'ar',
      email_verified_at: new Date(),
    });
    await this.userRepo.save(user);

    const clinic = this.clinicRepo.create({
      name: dto.clinic_name,
      phone: dto.clinic_phone,
      location: dto.clinic_location,
      permission_doc_url: dto.permission_doc_url,
      owner_id: user.id,
    });
    await this.clinicRepo.save(clinic);

    return this.buildAuthResponse(user);
  }

  async registerDoctor(dto: RegisterDoctorDto) {
    const email = this.normalizeEmail(dto.email);
    const existing = await this.userRepo.findOne({ where: { email } });
    if (existing) throw new ConflictException('Email already in use');

    const hash = await bcrypt.hash(dto.password, 10);
    const user = this.userRepo.create({
      email,
      password_hash: hash,
      role: UserRole.DOCTOR,
      photo_url: dto.photo_url ?? null,
      preferred_locale: 'ar',
      message_points: DEFAULT_MESSAGE_POINTS,
      points_spent_total: 0,
      points_purchased_total: 0,
      email_verified_at: new Date(),
    });
    await this.userRepo.save(user);

    const personalClinic = this.clinicRepo.create({
      name: dto.name,
      phone: dto.phone ?? '',
      location: '',
      owner_id: user.id,
      is_personal: true,
      approval_status: 'approved',
    });
    await this.clinicRepo.save(personalClinic);

    const speciality = await this.specialityRepo.findOne({
      where: { id: dto.speciality_id },
    });
    if (!speciality) {
      throw new ConflictException('Invalid speciality');
    }

    const doctor = this.doctorRepo.create({
      user_id: user.id,
      name: dto.name,
      age: dto.age,
      phone: dto.phone,
      country: dto.country.trim().toUpperCase(),
      photo_url: dto.photo_url,
      graduation_cert_url: dto.graduation_cert_url,
      work_permit_url: dto.work_permit_url,
      default_clinic_id: personalClinic.id,
      email,
      speciality_id: speciality.id,
      consultation_price: clampConsultationPrice(dto.consultation_price),
      ...defaultDoctorFeeColumns(dto.country),
      approval_status: 'approved',
    });
    await this.doctorRepo.save(doctor);

    user.doctor_info_id = doctor.id;
    await this.userRepo.save(user);

    void this.broadcastDoctorListed(doctor.id);

    return this.buildAuthResponse(user);
  }

  async verifyEmail(dto: VerifyEmailDto) {
    const email = this.normalizeEmail(dto.email);
    const user = await this.userRepo.findOne({ where: { email } });
    if (!user) {
      throw new BadRequestException('Invalid verification code');
    }
    if (this.isEmailVerified(user)) {
      return this.buildAuthResponse(user);
    }
    if (
      !user.email_verification_code_hash ||
      !user.email_verification_expires_at ||
      user.email_verification_expires_at.getTime() < Date.now()
    ) {
      throw new BadRequestException('Verification code expired. Request a new one.');
    }
    const ok = await bcrypt.compare(dto.code.trim(), user.email_verification_code_hash);
    if (!ok) {
      throw new BadRequestException('Invalid verification code');
    }

    user.email_verified_at = new Date();
    user.email_verification_code_hash = null;
    user.email_verification_expires_at = null;
    await this.userRepo.save(user);
    return this.buildAuthResponse(user);
  }

  async resendVerification(dto: ResendVerificationDto) {
    const email = this.normalizeEmail(dto.email);
    const user = await this.userRepo.findOne({ where: { email } });
    // Avoid email enumeration.
    if (!user || this.isEmailVerified(user)) {
      return { ok: true };
    }
    await this.issueVerificationCode(user);
    return { ok: true };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const email = this.normalizeEmail(dto.email);
    const user = await this.userRepo.findOne({ where: { email } });
    // Always succeed to avoid enumeration when the account does not exist.
    if (!user) {
      return { ok: true };
    }

    const rawToken = randomBytes(32).toString('hex');
    user.password_reset_token_hash = this.hashToken(rawToken);
    user.password_reset_expires_at = new Date(Date.now() + RESET_TTL_MS);
    await this.userRepo.save(user);

    const resetUrl = `${this.appWebUrl()}/auth/reset-password?token=${encodeURIComponent(rawToken)}`;
    try {
      await this.mailService.sendPasswordResetLink(user.email, resetUrl);
    } catch (err) {
      // Keep the token so a retry / resent link still works; surface a clear error.
      throw new BadRequestException(
        'Could not send the reset email. Please try again in a moment.',
      );
    }
    return { ok: true };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const token = (dto.token || '').trim();
    if (!token) {
      throw new BadRequestException('Reset token is required');
    }
    if (typeof dto.new_password !== 'string' || dto.new_password.length < 6) {
      throw new BadRequestException('Password must be at least 6 characters');
    }

    const tokenHash = this.hashToken(token);
    const user = await this.userRepo.findOne({
      where: { password_reset_token_hash: tokenHash },
    });
    if (
      !user ||
      !user.password_reset_expires_at ||
      user.password_reset_expires_at.getTime() < Date.now()
    ) {
      throw new BadRequestException('Reset link is invalid or expired');
    }

    user.password_hash = await bcrypt.hash(dto.new_password, 10);
    user.password_reset_token_hash = null;
    user.password_reset_expires_at = null;
    // Completing reset also confirms email ownership.
    if (!user.email_verified_at) {
      user.email_verified_at = new Date();
      user.email_verification_code_hash = null;
      user.email_verification_expires_at = null;
    }
    await this.userRepo.save(user);
    return { ok: true };
  }
}
