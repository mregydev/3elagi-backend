import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { resolveSpecialityPublicUrl } from '../constants/speciality-images';
import { DoctorSpeciality } from '../entities/doctor-speciality.entity';
import { Doctor } from '../entities/doctor.entity';
import { DoctorReview } from '../entities/review.entity';
import { User, UserRole } from '../entities/user.entity';

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

    const doctors = await this.doctorRepo
      .createQueryBuilder('d')
      .leftJoinAndSelect('d.speciality', 'spec')
      .where('d.approval_status = :status', { status: 'approved' })
      .andWhere(
        `(d.speciality_id = :specialityId OR EXISTS (
          SELECT 1 FROM doctor_speciality_links link
          WHERE link.doctor_id = d.id AND link.speciality_id = :specialityId
        ))`,
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

    return doctors.map((d) => {
      const user = userById.get(d.user_id);
      let name = d.name;
      if (!name.startsWith('Dr.')) name = `Dr. ${name}`;
      const rating = ratingByDoctorId.get(d.id);
      return {
        id: user?.id ?? d.user_id,
        doctor_id: d.id,
        name,
        photo_url: d.photo_url ?? user?.photo_url ?? null,
        specialty:
          requestedSpec?.name_en ??
          d.speciality?.name_en ??
          d.professional_title ??
          null,
        professional_title: d.professional_title,
        experience_years: d.experience_years,
        consultation_fee_egp: d.consultation_fee_egp,
        rating_average: rating?.average ?? 0,
        rating_total: rating?.total ?? 0,
        role: UserRole.DOCTOR,
      };
    });
  }
}
