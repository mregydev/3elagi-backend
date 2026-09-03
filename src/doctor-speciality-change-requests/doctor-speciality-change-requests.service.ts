import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Doctor } from '../entities/doctor.entity';
import { DoctorSpeciality } from '../entities/doctor-speciality.entity';
import { DoctorSpecialityChangeRequest } from '../entities/doctor-speciality-change-request.entity';
import { DoctorOnboardingService } from '../doctor-onboarding/doctor-onboarding.service';
import { KnowledgeIndexerService } from '../ai/knowledge-indexer.service';
import { DoctorTagsService } from '../doctor-tags/doctor-tags.service';

@Injectable()
export class DoctorSpecialityChangeRequestsService {
  constructor(
    @InjectRepository(DoctorSpecialityChangeRequest)
    private readonly requestRepo: Repository<DoctorSpecialityChangeRequest>,
    @InjectRepository(Doctor) private readonly doctorRepo: Repository<Doctor>,
    @InjectRepository(DoctorSpeciality)
    private readonly specialityRepo: Repository<DoctorSpeciality>,
    private readonly doctorOnboarding: DoctorOnboardingService,
    private readonly knowledgeIndexer: KnowledgeIndexerService,
    private readonly doctorTagsService: DoctorTagsService,
  ) {}

  async getPendingForDoctor(doctorId: string) {
    return this.requestRepo.findOne({
      where: { doctor_id: doctorId, status: 'pending' },
      order: { created_at: 'DESC' },
    });
  }

  async submitPrimaryChangeRequest(
    doctor: Doctor,
    requestedSpecialityIds: string[],
  ): Promise<DoctorSpecialityChangeRequest> {
    const ids = [...new Set(requestedSpecialityIds.filter(Boolean))].slice(0, 10);
    if (!ids.length) {
      throw new BadRequestException('Speciality is required');
    }

    const requestedPrimaryId = ids[0];
    const currentPrimaryId = doctor.speciality_id ?? null;
    if (requestedPrimaryId === currentPrimaryId) {
      throw new BadRequestException('Primary speciality unchanged');
    }

    const specs = await this.specialityRepo.find({ where: { id: In(ids) } });
    if (specs.length !== ids.length) {
      throw new BadRequestException('Invalid speciality');
    }
    const requestedPrimary = specs.find((s) => s.id === requestedPrimaryId)!;
    const currentPrimary = currentPrimaryId
      ? await this.specialityRepo.findOne({ where: { id: currentPrimaryId } })
      : null;

    const existing = await this.getPendingForDoctor(doctor.id);
    const payload = {
      doctor_id: doctor.id,
      doctor_user_id: doctor.user_id,
      doctor_name: doctor.name,
      doctor_email: doctor.email ?? null,
      current_speciality_id: currentPrimaryId,
      current_speciality_name_en: currentPrimary?.name_en ?? null,
      current_speciality_name_ar: currentPrimary?.name_ar ?? null,
      requested_speciality_id: requestedPrimaryId,
      requested_speciality_ids: ids,
      requested_speciality_name_en: requestedPrimary.name_en,
      requested_speciality_name_ar: requestedPrimary.name_ar,
      status: 'pending' as const,
      reviewed_at: null,
      reviewed_by_user_id: null,
    };

    if (existing) {
      await this.requestRepo.update(existing.id, payload);
      return (await this.requestRepo.findOne({ where: { id: existing.id } }))!;
    }

    return this.requestRepo.save(this.requestRepo.create(payload));
  }

  async listForAdmin(status: 'pending' | 'all' = 'pending') {
    const where = status === 'pending' ? { status: 'pending' as const } : {};
    return this.requestRepo.find({
      where,
      order: { created_at: 'DESC' },
      take: 200,
    });
  }

  async findOneForAdmin(id: string) {
    const row = await this.requestRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Request not found');
    return row;
  }

  async approve(id: string, adminUserId: string) {
    const request = await this.findOneForAdmin(id);
    if (request.status !== 'pending') {
      throw new BadRequestException('Request is not pending');
    }

    const doctor = await this.doctorRepo.findOne({
      where: { id: request.doctor_id },
      relations: ['specialities'],
    });
    if (!doctor) throw new NotFoundException('Doctor not found');

    const ids = request.requested_speciality_ids;
    const specs = await this.specialityRepo.find({ where: { id: In(ids) } });
    if (specs.length !== ids.length) {
      throw new BadRequestException('Invalid speciality in request');
    }
    const orderedSpecs = ids.map((specId) => specs.find((s) => s.id === specId)!);

    await this.doctorRepo.update(doctor.id, {
      speciality_id: request.requested_speciality_id,
    });
    doctor.specialities = orderedSpecs;
    await this.doctorRepo.save(doctor);

    if (Array.isArray(doctor.tags) && doctor.tags.length) {
      await this.doctorTagsService.registerDoctorTags(
        doctor.tags,
        request.requested_speciality_id,
      );
    }

    await this.doctorOnboarding.setupDoctorOnboarding(doctor.id, {
      removeOtherTestPatientChats: true,
    });

    void this.knowledgeIndexer.indexDoctor(doctor.id).catch(() => undefined);

    await this.requestRepo.update(request.id, {
      status: 'approved',
      reviewed_at: new Date(),
      reviewed_by_user_id: adminUserId,
    });

    return this.requestRepo.findOne({ where: { id: request.id } });
  }

  async reject(id: string, adminUserId: string) {
    const request = await this.findOneForAdmin(id);
    if (request.status !== 'pending') {
      throw new BadRequestException('Request is not pending');
    }
    await this.requestRepo.update(request.id, {
      status: 'rejected',
      reviewed_at: new Date(),
      reviewed_by_user_id: adminUserId,
    });
    return this.requestRepo.findOne({ where: { id: request.id } });
  }

  /** Apply speciality ids when primary stays the same (secondary-only edits). */
  async applySecondarySpecialities(
    doctor: Doctor,
    specialityIds: string[],
  ): Promise<void> {
    const ids = [...new Set(specialityIds.filter(Boolean))].slice(0, 10);
    const found = ids.length
      ? await this.specialityRepo.find({ where: { id: In(ids) } })
      : [];
    if (found.length !== ids.length) {
      throw new BadRequestException('Invalid speciality');
    }
    const ordered = ids.map((id) => found.find((s) => s.id === id)!);
    const withLinks = await this.doctorRepo.findOne({
      where: { id: doctor.id },
      relations: ['specialities'],
    });
    if (!withLinks) return;
    withLinks.specialities = ordered;
    if (!ids.includes(withLinks.speciality_id ?? '')) {
      withLinks.speciality_id = ids[0] ?? null;
    }
    await this.doctorRepo.save(withLinks);
  }

  toPublicRow(row: DoctorSpecialityChangeRequest | null) {
    if (!row || row.status !== 'pending') return null;
    return {
      id: row.id,
      status: row.status,
      current_speciality_id: row.current_speciality_id,
      current_speciality_name_en: row.current_speciality_name_en,
      current_speciality_name_ar: row.current_speciality_name_ar,
      requested_speciality_id: row.requested_speciality_id,
      requested_speciality_ids: row.requested_speciality_ids,
      requested_speciality_name_en: row.requested_speciality_name_en,
      requested_speciality_name_ar: row.requested_speciality_name_ar,
      created_at: row.created_at,
    };
  }

  async pendingPublicForDoctor(doctorId: string) {
    const row = await this.getPendingForDoctor(doctorId);
    return this.toPublicRow(row);
  }
}
