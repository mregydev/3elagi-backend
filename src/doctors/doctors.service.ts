import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Doctor } from '../entities/doctor.entity';
import { Clinic } from '../entities/clinic.entity';
import { DoctorSpeciality } from '../entities/doctor-speciality.entity';
import { clampDoctorMessagePrice } from '../points/message-price.constants';
import { KnowledgeIndexerService } from '../ai/knowledge-indexer.service';
import { PresenceGateway } from '../presence/presence.gateway';
import { SpecialitiesService } from '../specialities/specialities.service';

@Injectable()
export class DoctorsService {
  constructor(
    @InjectRepository(Doctor) private doctorRepo: Repository<Doctor>,
    @InjectRepository(Clinic) private clinicRepo: Repository<Clinic>,
    @InjectRepository(DoctorSpeciality)
    private specialityRepo: Repository<DoctorSpeciality>,
    private knowledgeIndexer: KnowledgeIndexerService,
    private presenceGateway: PresenceGateway,
    private specialitiesService: SpecialitiesService,
  ) {}

  async findByClinic(clinicId: string) {
    return this.doctorRepo.find({ where: { default_clinic_id: clinicId } });
  }

  async findById(id: string, userId: string, role: string) {
    const doctor = await this.doctorRepo.findOne({ where: { id } });
    if (!doctor) throw new NotFoundException('Doctor not found');
    if (role === 'doctor') {
      const self = await this.doctorRepo.findOne({ where: { user_id: userId } });
      if (!self || self.id !== id) {
        throw new ForbiddenException('You can only view your own doctor profile');
      }
    }
    return doctor;
  }

  async findByUserId(userId: string) {
    const doctor = await this.doctorRepo.findOne({
      where: { user_id: userId },
      relations: ['speciality'],
    });
    if (!doctor) return null;
    return {
      ...doctor,
      speciality_name_en: doctor.speciality?.name_en ?? null,
      speciality_name_ar: doctor.speciality?.name_ar ?? null,
    };
  }

  async removeFromClinic(doctorId: string, clinicId: string) {
    const clinic = await this.clinicRepo.findOne({ where: { id: clinicId } });
    if (!clinic) throw new NotFoundException('Clinic not found');

    const doctor = await this.doctorRepo.findOne({ where: { id: doctorId } });
    if (!doctor) throw new NotFoundException('Doctor not found');
    if (doctor.default_clinic_id !== clinicId) {
      throw new ForbiddenException('Doctor does not belong to this clinic');
    }
    doctor.default_clinic_id = null;
    return this.doctorRepo.save(doctor);
  }

  async updateSelf(userId: string, updates: Partial<Doctor>) {
    const doctor = await this.doctorRepo.findOne({ where: { user_id: userId } });
    if (!doctor) throw new NotFoundException('Doctor profile not found');
    // Whitelist: doctors must not be able to change privilege-sensitive fields
    const {
      name, phone, age, email, photo_url,
      graduation_cert_url, work_permit_url,
      digital_signature_url, personal_clinic_location,
      professional_title, description, experience_years, consultation_fee_egp,
      faqs, tags, speciality_id, message_price,
    } = updates as Partial<Doctor>;
    const safeUpdates: Partial<Doctor> = {};
    if (name !== undefined) safeUpdates.name = name;
    if (phone !== undefined) safeUpdates.phone = phone;
    if (age !== undefined) safeUpdates.age = age;
    if (email !== undefined) safeUpdates.email = email;
    if (photo_url !== undefined) safeUpdates.photo_url = photo_url;
    if (graduation_cert_url !== undefined) safeUpdates.graduation_cert_url = graduation_cert_url;
    if (work_permit_url !== undefined) safeUpdates.work_permit_url = work_permit_url;
    if (digital_signature_url !== undefined) safeUpdates.digital_signature_url = digital_signature_url;
    if (personal_clinic_location !== undefined) safeUpdates.personal_clinic_location = personal_clinic_location;
    if (professional_title !== undefined) safeUpdates.professional_title = professional_title;
    if (description !== undefined) safeUpdates.description = description;
    if (experience_years !== undefined) safeUpdates.experience_years = experience_years;
    if (consultation_fee_egp !== undefined) safeUpdates.consultation_fee_egp = consultation_fee_egp;
    if (faqs !== undefined) {
      const list = Array.isArray(faqs) ? faqs : [];
      safeUpdates.faqs = list
        .filter((f) => f && typeof f === 'object')
        .map((f) => ({
          id: typeof f.id === 'string' && f.id ? f.id : `faq_${Math.random().toString(36).slice(2, 10)}`,
          q: typeof f.q === 'string' ? f.q.trim().slice(0, 300) : '',
          a: typeof f.a === 'string' ? f.a.trim().slice(0, 2000) : '',
        }))
        .filter((f) => f.q && f.a);
    }
    if (tags !== undefined) {
      const list = Array.isArray(tags) ? tags : [];
      const seen = new Set<string>();
      safeUpdates.tags = list
        .map((t) => (typeof t === 'string' ? t.trim().slice(0, 40) : ''))
        .filter((t) => {
          if (!t) return false;
          const key = t.toLowerCase();
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .slice(0, 20);
    }
    if (speciality_id !== undefined) {
      const spec = await this.specialityRepo.findOne({ where: { id: speciality_id } });
      if (!spec) throw new BadRequestException('Invalid speciality');
      safeUpdates.speciality_id = speciality_id;
    }
    if (message_price !== undefined) {
      safeUpdates.message_price = clampDoctorMessagePrice(message_price);
    }
    await this.doctorRepo.update(doctor.id, safeUpdates);
    void this.knowledgeIndexer.indexDoctor(doctor.id).catch(() => undefined);

    return this.findByUserId(userId);
  }

  async updateDoctor(id: string, updates: Partial<Doctor>) {
    await this.doctorRepo.update(id, updates);
    void this.knowledgeIndexer.indexDoctor(id).catch(() => undefined);
    return this.doctorRepo.findOne({ where: { id } });
  }
}
