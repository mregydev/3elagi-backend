import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { User, UserRole } from '../entities/user.entity';
import { Doctor } from '../entities/doctor.entity';
import { PatientProfile } from '../entities/patient-profile.entity';
import { Patient } from '../entities/patient.entity';
import { DoctorReview } from '../entities/review.entity';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Doctor) private doctorRepo: Repository<Doctor>,
    @InjectRepository(PatientProfile)
    private patientProfileRepo: Repository<PatientProfile>,
    @InjectRepository(Patient) private patientRepo: Repository<Patient>,
    @InjectRepository(DoctorReview)
    private reviewRepo: Repository<DoctorReview>,
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
        const doctor =
          user.doctor_info_id
            ? await this.doctorRepo.findOne({ where: { id: user.doctor_info_id } })
            : await this.doctorRepo.findOne({ where: { user_id: userId } });
        if (doctor) {
          await this.doctorRepo.update({ id: doctor.id }, { photo_url: dto.photo_url });
        }
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
    const doctorInfoIds = otherUsers
      .filter((u) => u.doctor_info_id)
      .map((u) => u.doctor_info_id as string);

    const [doctorsByUser, doctorsByInfo, profiles] = await Promise.all([
      this.doctorRepo.find({
        where: { user_id: In(ids) },
        relations: ['speciality'],
      }),
      doctorInfoIds.length
        ? this.doctorRepo.find({
            where: { id: In(doctorInfoIds) },
            relations: ['speciality'],
          })
        : Promise.resolve([]),
      this.patientProfileRepo.find({ where: { user_id: In(ids) } }),
    ]);

    const doctorByUserId = new Map(doctorsByUser.map((d) => [d.user_id, d]));
    const doctorByInfoId = new Map(doctorsByInfo.map((d) => [d.id, d]));
    const profileByUserId = new Map(profiles.map((p) => [p.user_id, p]));

    const doctorIds = [...doctorsByUser, ...doctorsByInfo].map((d) => d.id);
    const ratingRows =
      doctorIds.length > 0
        ? await this.reviewRepo
            .createQueryBuilder('r')
            .select('r.doctor_id', 'doctor_id')
            .addSelect('COALESCE(AVG(r.rating), 0)', 'avg')
            .addSelect('COUNT(*)', 'total')
            .where('r.doctor_id IN (:...doctorIds)', { doctorIds })
            .groupBy('r.doctor_id')
            .getRawMany<{ doctor_id: string; avg: string; total: string }>()
        : [];
    const ratingByDoctorId = new Map(
      ratingRows.map((row) => [
        row.doctor_id,
        {
          average: Math.round(Number(row.avg) * 10) / 10,
          total: Number(row.total),
        },
      ]),
    );

    return otherUsers.flatMap((user) => {
      const doctor =
        (user.doctor_info_id
          ? doctorByInfoId.get(user.doctor_info_id)
          : undefined) ?? doctorByUserId.get(user.id);
      const profile = profileByUserId.get(user.id);

      if (user.role === UserRole.DOCTOR) {
        if (!doctor || doctor.approval_status !== 'approved') {
          return [];
        }
        if (user.email.endsWith('@3elagi.local')) {
          return [];
        }
      }

      let name = user.email.split('@')[0];
      let photo_url = user.photo_url ?? null;
      let specialty: string | null = null;
      let doctor_id: string | null = null;
      let message_price: number | null = null;
      let rating_average: number | null = null;
      let rating_total: number | null = null;

      if (user.role === UserRole.DOCTOR && doctor) {
        name = doctor.name;
        photo_url = doctor.photo_url ?? user.photo_url ?? null;
        specialty =
          doctor.speciality?.name_en ?? doctor.professional_title ?? null;
        doctor_id = doctor.id;
        message_price = doctor.message_price ?? 1;
        const rating = ratingByDoctorId.get(doctor.id);
        rating_average = rating?.average ?? 0;
        rating_total = rating?.total ?? 0;
      } else if (user.role === UserRole.PATIENT && profile) {
        name = profile.name;
        photo_url = profile.photo_url ?? user.photo_url ?? null;
      }

      if (user.role === UserRole.DOCTOR && !name.startsWith('Dr.')) {
        name = `Dr. ${name}`;
      }

      return [
        {
          id: user.id,
          email: user.email,
          role: user.role,
          name,
          photo_url,
          specialty,
          doctor_id,
          message_price,
          rating_average,
          rating_total,
        },
      ];
    });
  }

  async getDisplayName(userId: string): Promise<string> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) return 'Someone';

    if (user.role === UserRole.DOCTOR) {
      const doctor =
        user.doctor_info_id
          ? await this.doctorRepo.findOne({ where: { id: user.doctor_info_id } })
          : await this.doctorRepo.findOne({ where: { user_id: userId } });
      if (doctor?.name) {
        return doctor.name.startsWith('Dr.') ? doctor.name : `Dr. ${doctor.name}`;
      }
    }

    if (user.role === UserRole.PATIENT) {
      const profile = await this.patientProfileRepo.findOne({
        where: { user_id: userId },
      });
      if (profile?.name) return profile.name;
    }

    return user.email.split('@')[0];
  }

  /** Contact card for chat UI — includes users with existing threads even if not listable. */
  async getContactCard(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) return null;
    if (user.role !== UserRole.DOCTOR && user.role !== UserRole.PATIENT) {
      return null;
    }

    const doctor =
      user.role === UserRole.DOCTOR
        ? user.doctor_info_id
          ? await this.doctorRepo.findOne({
              where: { id: user.doctor_info_id },
              relations: ['speciality'],
            })
          : await this.doctorRepo.findOne({
              where: { user_id: userId },
              relations: ['speciality'],
            })
        : null;

    const profile =
      user.role === UserRole.PATIENT
        ? await this.patientProfileRepo.findOne({ where: { user_id: userId } })
        : null;

    let name = user.email.split('@')[0];
    let photo_url = user.photo_url ?? null;
    let specialty: string | null = null;
    let doctor_id: string | null = null;
    let message_price: number | null = null;
    let rating_average: number | null = null;
    let rating_total: number | null = null;

    if (user.role === UserRole.DOCTOR && doctor) {
      name = doctor.name;
      photo_url = doctor.photo_url ?? user.photo_url ?? null;
      specialty =
        doctor.speciality?.name_en ?? doctor.professional_title ?? null;
      doctor_id = doctor.id;
      message_price = doctor.message_price ?? 1;
      const rating = await this.reviewRepo
        .createQueryBuilder('r')
        .select('COALESCE(AVG(r.rating), 0)', 'avg')
        .addSelect('COUNT(*)', 'total')
        .where('r.doctor_id = :doctorId', { doctorId: doctor.id })
        .getRawOne<{ avg: string; total: string }>();
      rating_average = Math.round(Number(rating?.avg ?? 0) * 10) / 10;
      rating_total = Number(rating?.total ?? 0);
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
      doctor_id,
      message_price,
      rating_average,
      rating_total,
    };
  }

  async getContactCardOrThrow(userId: string) {
    const card = await this.getContactCard(userId);
    if (!card) throw new NotFoundException('User not found');
    return card;
  }
}
