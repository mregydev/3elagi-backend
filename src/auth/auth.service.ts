import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { User, UserRole } from '../entities/user.entity';
import { Clinic } from '../entities/clinic.entity';
import { Doctor } from '../entities/doctor.entity';
import { DoctorSpeciality } from '../entities/doctor-speciality.entity';
import { PatientProfile } from '../entities/patient-profile.entity';
import { LoginDto } from './dto/login.dto';
import { RegisterClinicDto } from './dto/register-clinic.dto';
import { RegisterDoctorDto } from './dto/register-doctor.dto';
import { RegisterPatientDto } from './dto/register-patient.dto';
import { DEFAULT_MESSAGE_POINTS } from '../points/points.constants';
import { clampDoctorMessagePrice } from '../points/message-price.constants';
import { PresenceGateway } from '../presence/presence.gateway';
import { SpecialitiesService } from '../specialities/specialities.service';

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
  ) {}

  private async broadcastDoctorListed(doctorId: string): Promise<void> {
    const payload = await this.specialitiesService.buildDoctorRosterPayload(doctorId);
    if (payload) {
      this.presenceGateway.broadcastDoctorRegistered(payload);
    }
  }

  async login(dto: LoginDto) {
    const user = await this.userRepo.findOne({ where: { email: dto.email } });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(dto.password, user.password_hash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    const payload = { sub: user.id, email: user.email, role: user.role };
    const token = this.jwtService.sign(payload);

    let profile: Clinic | Doctor | PatientProfile | null = null;
    if (user.role === UserRole.CLINIC_ADMIN) {
      profile = await this.clinicRepo.findOne({ where: { owner_id: user.id } });
    } else if (user.role === UserRole.DOCTOR) {
      profile = await this.doctorRepo.findOne({ where: { user_id: user.id } });
    } else if (user.role === UserRole.PATIENT) {
      profile = await this.patientProfileRepo.findOne({
        where: { user_id: user.id },
      });
    }

    return { access_token: token, role: user.role, user_id: user.id, profile };
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
    const existing = await this.userRepo.findOne({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already in use');

    const hash = await bcrypt.hash(dto.password, 10);
    const user = this.userRepo.create({
      email: dto.email,
      password_hash: hash,
      role: UserRole.PATIENT,
      photo_url: dto.photo_url ?? null,
      message_points: DEFAULT_MESSAGE_POINTS,
      points_spent_total: 0,
      points_purchased_total: 0,
    });
    await this.userRepo.save(user);

    const profile = this.patientProfileRepo.create({
      user_id: user.id,
      name: dto.name,
      phone: dto.phone,
      photo_url: dto.photo_url ?? null,
    });
    await this.patientProfileRepo.save(profile);

    const payload = { sub: user.id, email: user.email, role: user.role };
    const token = this.jwtService.sign(payload);

    return { access_token: token, role: user.role, user_id: user.id, profile };
  }

  async registerClinic(dto: RegisterClinicDto) {
    const existing = await this.userRepo.findOne({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already in use');

    const hash = await bcrypt.hash(dto.password, 10);
    const user = this.userRepo.create({
      email: dto.email,
      password_hash: hash,
      role: UserRole.CLINIC_ADMIN,
      photo_url: dto.photo_url ?? null,
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

    const payload = { sub: user.id, email: user.email, role: user.role };
    const token = this.jwtService.sign(payload);

    return { access_token: token, role: user.role, user_id: user.id, profile: clinic };
  }

  async registerDoctor(dto: RegisterDoctorDto) {
    const existing = await this.userRepo.findOne({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already in use');

    const hash = await bcrypt.hash(dto.password, 10);
    const user = this.userRepo.create({
      email: dto.email,
      password_hash: hash,
      role: UserRole.DOCTOR,
      photo_url: dto.photo_url ?? null,
      message_points: DEFAULT_MESSAGE_POINTS,
      points_spent_total: 0,
      points_purchased_total: 0,
    });
    await this.userRepo.save(user);

    const personalClinic = this.clinicRepo.create({
      name: dto.name,
      phone: dto.phone ?? '',
      location: '',
      owner_id: user.id,
      is_personal: true,
      approval_status: 'pending',
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
      photo_url: dto.photo_url,
      graduation_cert_url: dto.graduation_cert_url,
      work_permit_url: dto.work_permit_url,
      default_clinic_id: personalClinic.id,
      email: dto.email,
      speciality_id: speciality.id,
      message_price: clampDoctorMessagePrice(dto.message_price),
      approval_status: 'pending',
    });
    await this.doctorRepo.save(doctor);

    user.doctor_info_id = doctor.id;
    await this.userRepo.save(user);

    const profile = await this.doctorRepo.findOne({
      where: { id: doctor.id },
      relations: ['speciality'],
    });

    const payload = { sub: user.id, email: user.email, role: user.role };
    const token = this.jwtService.sign(payload);

    return { access_token: token, role: user.role, user_id: user.id, profile: profile ?? doctor };
  }
}
