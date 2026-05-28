import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { User, UserRole } from '../entities/user.entity';
import { Doctor } from '../entities/doctor.entity';
import { PatientProfile } from '../entities/patient-profile.entity';
import { Patient } from '../entities/patient.entity';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Doctor) private doctorRepo: Repository<Doctor>,
    @InjectRepository(PatientProfile)
    private patientProfileRepo: Repository<PatientProfile>,
    @InjectRepository(Patient) private patientRepo: Repository<Patient>,
  ) {}

  private sanitizeUser(user: User) {
    const { password_hash: _, ...safe } = user;
    return safe;
  }

  async getMe(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    return this.sanitizeUser(user);
  }

  async updateMe(userId: string, dto: UpdateUserDto) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    if (dto.photo_url !== undefined) {
      user.photo_url = dto.photo_url;
      await this.userRepo.save(user);

      if (user.role === UserRole.DOCTOR) {
        await this.doctorRepo.update({ user_id: userId }, { photo_url: dto.photo_url });
      } else if (user.role === UserRole.PATIENT) {
        const profile = await this.patientProfileRepo.findOne({
          where: { user_id: userId },
        });
        if (profile) {
          profile.photo_url = dto.photo_url;
          await this.patientProfileRepo.save(profile);
          await this.patientRepo.update(
            { phone: profile.phone },
            { photo_url: dto.photo_url },
          );
        }
      }
    }

    return this.sanitizeUser(user);
  }

  /** All doctor/patient users for in-app chat (excludes requester). */
  async listContacts(requesterId: string) {
    const users = await this.userRepo.find({
      where: { role: In([UserRole.DOCTOR, UserRole.PATIENT]) },
      order: { created_at: 'DESC' },
    });

    const otherUsers = users.filter((u) => u.id !== requesterId);
    if (otherUsers.length === 0) return [];

    const ids = otherUsers.map((u) => u.id);
    const [doctors, profiles] = await Promise.all([
      this.doctorRepo.find({ where: { user_id: In(ids) } }),
      this.patientProfileRepo.find({ where: { user_id: In(ids) } }),
    ]);
    const doctorByUserId = new Map(doctors.map((d) => [d.user_id, d]));
    const profileByUserId = new Map(profiles.map((p) => [p.user_id, p]));

    return otherUsers.map((user) => {
      const doctor = doctorByUserId.get(user.id);
      const profile = profileByUserId.get(user.id);
      let name = user.email.split('@')[0];
      let photo_url = user.photo_url ?? null;
      let specialty: string | null = null;

      if (user.role === UserRole.DOCTOR && doctor) {
        name = doctor.name;
        photo_url = doctor.photo_url ?? user.photo_url ?? null;
        specialty = doctor.professional_title ?? null;
      } else if (user.role === UserRole.PATIENT && profile) {
        name = profile.name;
        photo_url = profile.photo_url ?? user.photo_url ?? null;
      }

      if (user.role === UserRole.DOCTOR && !name.startsWith('Dr.')) {
        name = `Dr. ${name}`;
      }

      return {
        id: user.id,
        email: user.email,
        role: user.role,
        name,
        photo_url,
        specialty,
      };
    });
  }
}
