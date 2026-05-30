import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { DoctorSpeciality } from '../entities/doctor-speciality.entity';
import { Doctor } from '../entities/doctor.entity';
import { User, UserRole } from '../entities/user.entity';

@Injectable()
export class SpecialitiesService {
  constructor(
    @InjectRepository(DoctorSpeciality)
    private specialityRepo: Repository<DoctorSpeciality>,
    @InjectRepository(Doctor) private doctorRepo: Repository<Doctor>,
    @InjectRepository(User) private userRepo: Repository<User>,
  ) {}

  async findAll() {
    const rows = await this.specialityRepo.find({
      order: { name_en: 'ASC' },
    });
    return rows.map((s) => ({
      id: s.id,
      name_en: s.name_en,
      name_ar: s.name_ar,
      image_url: s.image_url,
    }));
  }

  async findDoctorsBySpeciality(specialityId: string) {
    const doctors = await this.doctorRepo.find({
      where: { speciality_id: specialityId, approval_status: 'approved' },
      order: { name: 'ASC' },
      relations: ['speciality'],
    });

    if (doctors.length === 0) return [];

    const userIds = doctors.map((d) => d.user_id);
    const users = await this.userRepo.find({
      where: { id: In(userIds) },
    });
    const userById = new Map(users.map((u) => [u.id, u]));

    return doctors.map((d) => {
      const user = userById.get(d.user_id);
      let name = d.name;
      if (!name.startsWith('Dr.')) name = `Dr. ${name}`;
      return {
        id: user?.id ?? d.user_id,
        doctor_id: d.id,
        name,
        photo_url: d.photo_url ?? user?.photo_url ?? null,
        specialty:
          d.speciality?.name_en ?? d.professional_title ?? null,
        professional_title: d.professional_title,
        experience_years: d.experience_years,
        consultation_fee_egp: d.consultation_fee_egp,
        role: UserRole.DOCTOR,
      };
    });
  }
}
