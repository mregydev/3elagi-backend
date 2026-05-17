import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
}
