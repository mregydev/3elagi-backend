import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DoctorRegistrationRequest } from '../entities/doctor-registration-request.entity';
import { DoctorSpeciality } from '../entities/doctor-speciality.entity';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

@Injectable()
export class DoctorRegistrationRequestsService {
  constructor(
    @InjectRepository(DoctorRegistrationRequest)
    private readonly requestRepo: Repository<DoctorRegistrationRequest>,
    @InjectRepository(DoctorSpeciality)
    private readonly specialityRepo: Repository<DoctorSpeciality>,
  ) {}

  async submit(input: {
    doctorName: string;
    email: string;
    phone: string;
    specialityId: string;
  }) {
    const doctorName = (input.doctorName || '').trim();
    const email = (input.email || '').trim().toLowerCase();
    const phone = (input.phone || '').trim();
    const specialityId = (input.specialityId || '').trim();

    if (doctorName.length < 2) {
      throw new BadRequestException('Doctor name is required');
    }
    if (!email) {
      throw new BadRequestException('Email is required');
    }
    if (!EMAIL_RE.test(email)) {
      throw new BadRequestException('Invalid email address');
    }
    if (!phone) {
      throw new BadRequestException('Phone number is required');
    }
    if (!specialityId) {
      throw new BadRequestException('Speciality is required');
    }

    const speciality = await this.specialityRepo.findOne({
      where: { id: specialityId },
    });
    if (!speciality) {
      throw new BadRequestException('Speciality not found');
    }

    const saved = await this.requestRepo.save(
      this.requestRepo.create({
        doctor_name: doctorName,
        email,
        phone,
        speciality_id: speciality.id,
        speciality_name_en: speciality.name_en,
        speciality_name_ar: speciality.name_ar,
      }),
    );

    return { ok: true, id: saved.id };
  }

  async listForAdmin() {
    const rows = await this.requestRepo.find({
      order: { created_at: 'DESC' },
      take: 200,
    });
    return rows.map((row) => this.mapRow(row));
  }

  async findOneForAdmin(id: string) {
    const row = await this.requestRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Registration request not found');
    if (!row.read_at) {
      row.read_at = new Date();
      await this.requestRepo.save(row);
    }
    return this.mapRow(row);
  }

  async markRead(id: string, read: boolean) {
    const row = await this.requestRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Registration request not found');
    row.read_at = read ? row.read_at ?? new Date() : null;
    await this.requestRepo.save(row);
    return this.mapRow(row);
  }

  private mapRow(row: DoctorRegistrationRequest) {
    return {
      id: row.id,
      doctor_name: row.doctor_name,
      email: row.email,
      phone: row.phone,
      speciality_id: row.speciality_id,
      speciality_name_en: row.speciality_name_en,
      speciality_name_ar: row.speciality_name_ar,
      read_at: row.read_at?.toISOString() ?? null,
      created_at: row.created_at.toISOString(),
    };
  }
}
