import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { resolveSpecialityPublicUrl } from '../constants/speciality-images';
import { DoctorSpeciality } from '../entities/doctor-speciality.entity';
import { Doctor } from '../entities/doctor.entity';
import { DoctorReview } from '../entities/review.entity';
import { User, UserRole } from '../entities/user.entity';
import { VideoCallSession } from '../entities/video-call-session.entity';
import { busyDoctorUserIds } from '../video-calls/live-session';
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
    @InjectRepository(VideoCallSession)
    private sessionRepo: Repository<VideoCallSession>,
  ) {}

  async findAll(country?: string) {
    const market = country?.trim().toUpperCase();
    const qb = this.specialityRepo
      .createQueryBuilder('s')
      .orderBy('s.name_en', 'ASC');

    if (market === 'EG') {
      qb.andWhere('s.visible_eg = true');
    } else if (market === 'JO') {
      qb.andWhere('s.visible_jo = true');
    }

    const rows = await qb.getMany();
    return rows.map((s) => ({
      id: s.id,
      name_en: s.name_en,
      name_ar: s.name_ar,
      image_url: resolveSpecialityPublicUrl(s.image_url),
    }));
  }

  /** Admin: full list with per-market visibility flags. */
  async findAllForAdmin() {
    const rows = await this.specialityRepo.find({
      order: { name_en: 'ASC' },
    });
    return rows.map((s) => ({
      id: s.id,
      name_en: s.name_en,
      name_ar: s.name_ar,
      image_url: resolveSpecialityPublicUrl(s.image_url),
      visible_eg: s.visible_eg !== false,
      visible_jo: s.visible_jo !== false,
    }));
  }

  async updateVisibility(
    id: string,
    patch: { visible_eg?: boolean; visible_jo?: boolean },
  ) {
    const row = await this.specialityRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Speciality not found');

    if (typeof patch.visible_eg === 'boolean') row.visible_eg = patch.visible_eg;
    if (typeof patch.visible_jo === 'boolean') row.visible_jo = patch.visible_jo;

    const saved = await this.specialityRepo.save(row);
    return {
      id: saved.id,
      name_en: saved.name_en,
      name_ar: saved.name_ar,
      image_url: resolveSpecialityPublicUrl(saved.image_url),
      visible_eg: saved.visible_eg !== false,
      visible_jo: saved.visible_jo !== false,
    };
  }

  async findDoctorsBySpeciality(specialityId: string, country?: string) {
    const requestedSpec = await this.specialityRepo.findOne({
      where: { id: specialityId },
    });
    if (!requestedSpec) {
      throw new NotFoundException('Speciality not found');
    }

    const qb = this.doctorRepo
      .createQueryBuilder('d')
      .leftJoinAndSelect('d.speciality', 'speciality')
      .where('d.approval_status = :approved', { approved: 'approved' })
      .andWhere(
        '(d.speciality_id = :specialityId OR EXISTS (SELECT 1 FROM doctor_speciality_links dsl WHERE dsl.doctor_id = d.id AND dsl.speciality_id = :specialityId))',
        { specialityId },
      );

    const market = country?.trim().toUpperCase();
    if (market === 'EG' || market === 'JO') {
      qb.andWhere('UPPER(COALESCE(d.country, :defaultCountry)) = :market', {
        market,
        defaultCountry: 'EG',
      });
    }

    const doctors = await qb.orderBy('d.name', 'ASC').getMany();

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

    const busy = await busyDoctorUserIds(this.sessionRepo, userIds);

    return doctors.map((d) =>
      this.mapDoctorRow(
        d,
        userById.get(d.user_id),
        requestedSpec,
        ratingByDoctorId.get(d.id),
        busy.has(d.user_id),
      ),
    );
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
    onCall = false,
  ): DoctorRosterPayload {
    let name = d.name;
    if (!name.startsWith('Dr.')) name = `Dr. ${name}`;
    return {
      id: user?.id ?? d.user_id,
      doctor_id: d.id,
      name,
      photo_url: d.photo_url ?? user?.photo_url ?? null,
      country: d.country ?? 'EG',
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
      immediate_call_enabled: !!d.immediate_call_enabled,
      on_call: onCall,
      role: UserRole.DOCTOR,
    };
  }
}
