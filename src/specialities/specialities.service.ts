import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { resolveSpecialityPublicUrl } from '../constants/speciality-images';
import { DoctorSpeciality } from '../entities/doctor-speciality.entity';
import { Doctor } from '../entities/doctor.entity';
import { DoctorReview } from '../entities/review.entity';
import { User, UserRole } from '../entities/user.entity';
import type { DoctorRosterPayload } from './doctor-roster.types';

export { DoctorRosterPayload };

@Injectable()
export class SpecialitiesService {
  constructor(
    @InjectRepository(DoctorSpeciality)
    private specialityRepo: Repository<DoctorSpeciality>,
    @InjectRepository(Doctor) private doctorRepo: Repository<Doctor>,
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(DoctorReview)
    private reviewRepo: Repository<DoctorReview>,
  ) {}

  async findAll() {
    const rows = await this.specialityRepo.find({
      order: { name_en: 'ASC' },
    });
    return rows.map((s) => ({
      id: s.id,
      name_en: s.name_en,
      name_ar: s.name_ar,
      image_url: resolveSpecialityPublicUrl(s.image_url),
    }));
  }

  async findDoctorsBySpeciality(specialityId: string) {
    const requestedSpec = await this.specialityRepo.findOne({
      where: { id: specialityId },
    });
    if (!requestedSpec) {
      throw new NotFoundException('Speciality not found');
    }

    const doctors = await this.doctorRepo
      .createQueryBuilder('d')
      .leftJoinAndSelect('d.speciality', 'speciality')
      .where('d.approval_status = :approved', { approved: 'approved' })
      .andWhere(
        '(d.speciality_id = :specialityId OR EXISTS (SELECT 1 FROM doctor_speciality_links dsl WHERE dsl.doctor_id = d.id AND dsl.speciality_id = :specialityId))',
        { specialityId },
      )
      .orderBy('d.name', 'ASC')
      .getMany();

    if (doctors.length === 0) return [];

    const userIds = doctors.map((d) => d.user_id);
    const users = await this.userRepo.find({
      where: { id: In(userIds) },
    });
    const userById = new Map(users.map((u) => [u.id, u]));

    const doctorIds = doctors.map((d) => d.id);
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

    return doctors.map((d) => this.mapDoctorRow(d, userById.get(d.user_id), requestedSpec, ratingByDoctorId.get(d.id)));
  }

  /** Build a realtime roster payload for an approved doctor. */
  async buildDoctorRosterPayload(doctorId: string): Promise<DoctorRosterPayload | null> {
    const doctor = await this.doctorRepo.findOne({
      where: { id: doctorId, approval_status: 'approved' },
      relations: ['speciality'],
    });
    if (!doctor?.speciality_id) return null;

    const user = await this.userRepo.findOne({ where: { id: doctor.user_id } });
    const requestedSpec = doctor.speciality ?? (await this.specialityRepo.findOne({
      where: { id: doctor.speciality_id },
    }));

    const ratingRow = await this.reviewRepo
      .createQueryBuilder('r')
      .select('COALESCE(AVG(r.rating), 0)', 'avg')
      .addSelect('COUNT(*)', 'total')
      .where('r.doctor_id = :doctorId', { doctorId: doctor.id })
      .getRawOne<{ avg: string; total: string }>();

    const rating = ratingRow
      ? {
          average: Math.round(Number(ratingRow.avg) * 10) / 10,
          total: Number(ratingRow.total),
        }
      : { average: 0, total: 0 };

    return this.mapDoctorRow(doctor, user, requestedSpec, rating);
  }

  private mapDoctorRow(
    d: Doctor,
    user: User | undefined,
    requestedSpec: DoctorSpeciality | null | undefined,
    rating?: { average: number; total: number },
  ): DoctorRosterPayload {
    let name = d.name;
    if (!name.startsWith('Dr.')) name = `Dr. ${name}`;
    return {
      id: user?.id ?? d.user_id,
      doctor_id: d.id,
      name,
      photo_url: d.photo_url ?? user?.photo_url ?? null,
      specialty:
        d.speciality?.name_en ??
        requestedSpec?.name_en ??
        d.professional_title ??
        null,
      speciality_id: d.speciality_id ?? requestedSpec?.id ?? '',
      professional_title: d.professional_title,
      experience_years: d.experience_years,
      consultation_fee_egp: d.consultation_fee_egp,
      consultation_price: d.consultation_price ?? 1,
      rating_average: rating?.average ?? 0,
      rating_total: rating?.total ?? 0,
      role: UserRole.DOCTOR,
    };
  }
}
