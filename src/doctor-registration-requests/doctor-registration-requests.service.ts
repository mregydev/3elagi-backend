import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DoctorRegistrationRequest } from '../entities/doctor-registration-request.entity';
import { DoctorSpeciality } from '../entities/doctor-speciality.entity';
import { DOCTOR_SIGNUP_COUNTRY_CODES } from '../common/patient-countries';
import { UploadsService } from '../uploads/uploads.service';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALLOWED_COUNTRIES = new Set<string>(DOCTOR_SIGNUP_COUNTRY_CODES);

@Injectable()
export class DoctorRegistrationRequestsService {
  constructor(
    @InjectRepository(DoctorRegistrationRequest)
    private readonly requestRepo: Repository<DoctorRegistrationRequest>,
    @InjectRepository(DoctorSpeciality)
    private readonly specialityRepo: Repository<DoctorSpeciality>,
    private readonly uploads: UploadsService,
  ) {}

  async submit(input: {
    doctorName: string;
    email: string;
    phone: string;
    country: string;
    specialityId: string;
    clinicLocation?: string;
    photo: Express.Multer.File;
  }) {
    const doctorName = (input.doctorName || '').trim();
    const email = (input.email || '').trim().toLowerCase();
    const phone = (input.phone || '').trim();
    const country = (input.country || '').trim().toUpperCase();
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
    if (!ALLOWED_COUNTRIES.has(country)) {
      throw new BadRequestException(
        'Country must be Egypt, Jordan, United States, or United Kingdom',
      );
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

    if (!input.photo?.buffer?.length) {
      throw new BadRequestException('Profile photo is required');
    }

    let photoUrl: string | null = null;
    try {
      const uploaded = await this.uploads.uploadFile({
        ...input.photo,
        originalname: input.photo.originalname || 'doctor-photo.jpg',
        mimetype: input.photo.mimetype || 'image/jpeg',
      });
      photoUrl = uploaded.url;
    } catch {
      throw new BadRequestException('Could not upload profile photo');
    }

    const clinicLocation = (input.clinicLocation || '').trim() || null;

    const saved = await this.requestRepo.save(
      this.requestRepo.create({
        doctor_name: doctorName,
        email,
        phone,
        country,
        clinic_location: clinicLocation,
        photo_url: photoUrl,
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
      country: row.country,
      clinic_location: row.clinic_location,
      photo_url: row.photo_url,
      speciality_id: row.speciality_id,
      speciality_name_en: row.speciality_name_en,
      speciality_name_ar: row.speciality_name_ar,
      read_at: row.read_at?.toISOString() ?? null,
      created_at: row.created_at.toISOString(),
    };
  }
}
