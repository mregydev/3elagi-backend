import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Doctor } from '../entities/doctor.entity';
import { Clinic } from '../entities/clinic.entity';
import { DoctorSpeciality } from '../entities/doctor-speciality.entity';
import {
  clampConsultationPrice,
  clampVideoConsultationMinutes,
} from '../points/message-price.constants';
import { KnowledgeIndexerService } from '../ai/knowledge-indexer.service';
import { PresenceGateway } from '../presence/presence.gateway';
import { SpecialitiesService } from '../specialities/specialities.service';
import { DoctorTagsService } from '../doctor-tags/doctor-tags.service';
import { DoctorOnboardingService } from '../doctor-onboarding/doctor-onboarding.service';
import { DoctorSpecialityChangeRequestsService } from '../doctor-speciality-change-requests/doctor-speciality-change-requests.service';
import { sortPrimaryFirst } from './speciality-order';

export { sortPrimaryFirst } from './speciality-order';

/** Money columns arrive from the client as numbers; the entity stores strings. */
type FeeColumn =
  | 'text_price_local'
  | 'text_price_usd'
  | 'video_price_local'
  | 'video_price_usd';

export type DoctorSelfUpdate = Partial<Omit<Doctor, FeeColumn>> &
  Partial<Record<FeeColumn, number | string | null>>;

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
    private doctorTagsService: DoctorTagsService,
    private doctorOnboarding: DoctorOnboardingService,
    private specialityChangeRequests: DoctorSpecialityChangeRequestsService,
  ) {}

  private withoutBankDetails<T extends Partial<Doctor>>(doctor: T): Omit<
    T,
    'iban' | 'account_holder_full_name' | 'national_id'
  > {
    const {
      iban: _iban,
      account_holder_full_name: _holder,
      national_id: _nid,
      ...safe
    } = doctor as T & {
      iban?: string | null;
      account_holder_full_name?: string | null;
      national_id?: string | null;
    };
    return safe;
  }

  async findByClinic(clinicId: string) {
    const doctors = await this.doctorRepo.find({
      where: { default_clinic_id: clinicId },
    });
    return doctors.map((d) => this.withoutBankDetails(d));
  }

  async findById(id: string, userId: string, role: string) {
    const doctor = await this.doctorRepo.findOne({ where: { id } });
    if (!doctor) throw new NotFoundException('Doctor not found');
    if (role === 'doctor') {
      const self = await this.doctorRepo.findOne({ where: { user_id: userId } });
      if (!self || self.id !== id) {
        throw new ForbiddenException('You can only view your own doctor profile');
      }
      return doctor;
    }
    return this.withoutBankDetails(doctor);
  }

  async findByUserId(userId: string) {
    const doctor = await this.doctorRepo.findOne({
      where: { user_id: userId },
      relations: ['speciality', 'specialities'],
    });
    if (!doctor) return null;
    const pendingSpecialityChange =
      await this.specialityChangeRequests.pendingPublicForDoctor(doctor.id);
    return {
      ...doctor,
      speciality_name_en: doctor.speciality?.name_en ?? null,
      speciality_name_ar: doctor.speciality?.name_ar ?? null,
      // Primary first, so a client showing only one still shows the right one.
      speciality_ids: sortPrimaryFirst(doctor),
      onboarding_test_patient_user_id: doctor.onboarding_test_patient_user_id ?? null,
      product_tour_completed_at: doctor.product_tour_completed_at ?? null,
      profile_tour_completed_at: doctor.profile_tour_completed_at ?? null,
      pending_speciality_change: pendingSpecialityChange,
    };
  }

  async ensureOnboarding(userId: string) {
    const doctor = await this.doctorRepo.findOne({ where: { user_id: userId } });
    if (!doctor || doctor.approval_status !== 'approved') {
      return { test_patient_user_id: null };
    }
    return this.doctorOnboarding.setupDoctorOnboarding(doctor.id);
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

  async updateSelf(userId: string, updates: DoctorSelfUpdate) {
    const doctor = await this.doctorRepo.findOne({ where: { user_id: userId } });
    if (!doctor) throw new NotFoundException('Doctor profile not found');
    const previousPrimarySpecialityId = doctor.speciality_id;
    // Whitelist: doctors must not be able to change privilege-sensitive fields
    const {
      name, phone, country, age, email, photo_url,
      graduation_cert_url, work_permit_url,
      digital_signature_url, personal_clinic_location,
      professional_title, description, experience_years, consultation_fee_egp,
      faqs, tags, certification_urls, speciality_id,
      consultation_price, video_consultation_price, video_consultation_minutes,
      immediate_call_enabled,
      text_price_local, text_price_usd, video_price_local, video_price_usd,
      payment_link,
      iban, account_holder_full_name, national_id,
    } = updates as DoctorSelfUpdate;
    const safeUpdates: Partial<Doctor> = {};
    if (name !== undefined) safeUpdates.name = name;
    if (phone !== undefined) safeUpdates.phone = phone;
    if (country !== undefined) {
      safeUpdates.country = String(country).trim().toUpperCase();
    }
    // Cash fees are free-form money; keep 2dp and drop anything not a number.
    for (const [key, value] of Object.entries({
      text_price_local,
      text_price_usd,
      video_price_local,
      video_price_usd,
    })) {
      if (value === undefined) continue;
      const amount = Number(value);
      safeUpdates[key] =
        value === null || !Number.isFinite(amount) || amount < 0
          ? null
          : amount.toFixed(2);
    }
    if (payment_link !== undefined) {
      safeUpdates.payment_link = String(payment_link ?? '').trim() || null;
    }
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
      safeUpdates.tags = this.doctorTagsService.normalizeTags(tags);
    }
    if (certification_urls !== undefined) {
      const list = Array.isArray(certification_urls) ? certification_urls : [];
      const seen = new Set<string>();
      safeUpdates.certification_urls = list
        .map((c) => ({
          url: typeof c?.url === 'string' ? c.url.trim() : '',
          description:
            typeof c?.description === 'string'
              ? c.description.trim().slice(0, 300)
              : '',
        }))
        .filter((c) => {
          if (!c.url || seen.has(c.url)) return false;
          seen.add(c.url);
          return true;
        })
        .slice(0, 20);
    }
    let requestedSpecialityIds: string[] | null = null;
    let nextSpecialities: DoctorSpeciality[] | null = null;

    const specialityIds = (updates as { speciality_ids?: unknown })
      .speciality_ids;
    if (specialityIds !== undefined) {
      const ids = Array.isArray(specialityIds)
        ? [...new Set(specialityIds.filter((id): id is string => !!id))].slice(0, 10)
        : [];
      const found = ids.length
        ? await this.specialityRepo.find({ where: { id: In(ids) } })
        : [];
      if (found.length !== ids.length) {
        throw new BadRequestException('Invalid speciality');
      }
      requestedSpecialityIds = ids;
      nextSpecialities = ids.map((id) => found.find((s) => s.id === id)!);
    } else if (speciality_id !== undefined) {
      const currentIds = sortPrimaryFirst(doctor);
      requestedSpecialityIds = [
        speciality_id,
        ...currentIds.filter((id) => id !== speciality_id),
      ];
      const found = await this.specialityRepo.find({
        where: { id: In(requestedSpecialityIds) },
      });
      if (found.length !== requestedSpecialityIds.length) {
        throw new BadRequestException('Invalid speciality');
      }
      nextSpecialities = requestedSpecialityIds.map(
        (id) => found.find((s) => s.id === id)!,
      );
    }

    const requestedPrimaryId =
      requestedSpecialityIds?.[0] ??
      (speciality_id !== undefined ? speciality_id : null);
    const primaryWouldChange =
      !!requestedPrimaryId &&
      requestedPrimaryId !== previousPrimarySpecialityId;

    if (primaryWouldChange && requestedSpecialityIds) {
      await this.specialityChangeRequests.submitPrimaryChangeRequest(
        doctor,
        requestedSpecialityIds,
      );
      delete safeUpdates.speciality_id;
      nextSpecialities = null;
    } else {
      if (speciality_id !== undefined) {
        const spec = await this.specialityRepo.findOne({
          where: { id: speciality_id },
        });
        if (!spec) throw new BadRequestException('Invalid speciality');
        safeUpdates.speciality_id = speciality_id;
      }
      if (nextSpecialities && safeUpdates.speciality_id === undefined) {
        safeUpdates.speciality_id = nextSpecialities[0]?.id ?? null;
      }
    }
    if (consultation_price !== undefined) {
      safeUpdates.consultation_price = clampConsultationPrice(consultation_price);
    }
    if (video_consultation_price !== undefined) {
      safeUpdates.video_consultation_price = clampConsultationPrice(
        video_consultation_price,
      );
    }
    if (video_consultation_minutes !== undefined) {
      safeUpdates.video_consultation_minutes = clampVideoConsultationMinutes(
        video_consultation_minutes,
      );
    }
    if (immediate_call_enabled !== undefined) {
      safeUpdates.immediate_call_enabled = !!immediate_call_enabled;
    }
    if (iban !== undefined) {
      const cleaned =
        typeof iban === 'string'
          ? iban.replace(/\s+/g, '').toUpperCase().slice(0, 64)
          : '';
      safeUpdates.iban = cleaned || null;
    }
    if (account_holder_full_name !== undefined) {
      const cleaned =
        typeof account_holder_full_name === 'string'
          ? account_holder_full_name.trim().slice(0, 200)
          : '';
      safeUpdates.account_holder_full_name = cleaned || null;
    }
    if (national_id !== undefined) {
      const cleaned =
        typeof national_id === 'string'
          ? national_id.replace(/\s+/g, '').slice(0, 32)
          : '';
      safeUpdates.national_id = cleaned || null;
    }
    await this.doctorRepo.update(doctor.id, safeUpdates);
    if (safeUpdates.tags !== undefined) {
      const primarySpecialityId =
        safeUpdates.speciality_id ?? doctor.speciality_id ?? null;
      await this.doctorTagsService.registerDoctorTags(
        safeUpdates.tags,
        primarySpecialityId,
      );
    }
    if (nextSpecialities) {
      // Saving the relation rewrites the link rows to exactly this set.
      const withLinks = await this.doctorRepo.findOne({
        where: { id: doctor.id },
        relations: ['specialities'],
      });
      if (withLinks) {
        withLinks.specialities = nextSpecialities;
        await this.doctorRepo.save(withLinks);
      }
    }
    void this.knowledgeIndexer.indexDoctor(doctor.id).catch(() => undefined);

    const updatedDoctor = await this.doctorRepo.findOne({ where: { id: doctor.id } });
    if (
      updatedDoctor?.speciality_id &&
      updatedDoctor.speciality_id !== previousPrimarySpecialityId &&
      !primaryWouldChange
    ) {
      await this.doctorOnboarding.syncDemoPatientForDoctor(updatedDoctor.id, {
        resetChat: true,
      });
    }

    return this.findByUserId(userId);
  }

  async updateDoctor(id: string, updates: Partial<Doctor>) {
    await this.doctorRepo.update(id, updates);
    void this.knowledgeIndexer.indexDoctor(id).catch(() => undefined);
    return this.doctorRepo.findOne({ where: { id } });
  }
}
