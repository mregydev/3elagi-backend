import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Diagnosis } from '../entities/diagnosis.entity';
import { Doctor } from '../entities/doctor.entity';
import { DoctorPatientAccess } from '../entities/doctor-patient-access.entity';
import { MedicalDocument } from '../entities/medical-document.entity';
import { Prescription } from '../entities/prescription.entity';
import { UserRole } from '../entities/user.entity';
import type { AiLinkEntry } from './ai-response.service';
import type { AiContextUser } from './context/ai-context.types';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const MARKDOWN_LINK_RE =
  /\[([^\]]+)\]\((\/(?:medical|doctor)\/[0-9a-f-]+)\)/gi;

@Injectable()
export class AiLinkValidatorService {
  constructor(
    @InjectRepository(Diagnosis)
    private readonly diagnosisRepo: Repository<Diagnosis>,
    @InjectRepository(MedicalDocument)
    private readonly docRepo: Repository<MedicalDocument>,
    @InjectRepository(Prescription)
    private readonly prescriptionRepo: Repository<Prescription>,
    @InjectRepository(Doctor)
    private readonly doctorRepo: Repository<Doctor>,
    @InjectRepository(DoctorPatientAccess)
    private readonly accessRepo: Repository<DoctorPatientAccess>,
  ) {}

  async sanitizeResponse(
    text: string,
    _allowedLinks: AiLinkEntry[],
    user: AiContextUser,
  ): Promise<string> {
    const patientIds = await this.resolveAccessiblePatientIds(user);
    const validationCache = new Map<string, string | null>();

    let next = text;
    const matches = [...text.matchAll(MARKDOWN_LINK_RE)];
    for (const match of matches) {
      const [full, label, rawPath] = match;
      const normalized = this.normalizePath(rawPath);

      let validPath = validationCache.get(normalized);
      if (validPath === undefined) {
        validPath = await this.resolveValidPath(normalized, user, patientIds);
        validationCache.set(normalized, validPath);
      }

      if (validPath) {
        if (validPath !== normalized) {
          next = next.replace(full, `[${label}](${validPath})`);
        }
      } else {
        next = next.replace(full, label);
      }
    }

    return this.stripBareInvalidPaths(next, user, patientIds, validationCache);
  }

  private normalizePath(path: string): string {
    const trimmed = path.trim().split('?')[0].split('#')[0];
    const match = trimmed.match(/^(\/(?:medical|doctor)\/[0-9a-f-]+)/i);
    return match?.[1] ?? trimmed;
  }

  private async resolveValidPath(
    path: string,
    user: AiContextUser,
    patientIds: string[],
  ): Promise<string | null> {
    const medical = path.match(/^\/medical\/(.+)$/i);
    if (medical) {
      const id = medical[1];
      return (await this.isAccessibleMedicalRecord(id, patientIds)) ? `/medical/${id}` : null;
    }

    const doctor = path.match(/^\/doctor\/(.+)$/i);
    if (doctor) {
      return this.resolveDoctorPath(doctor[1]);
    }

    return null;
  }

  private async resolveDoctorPath(id: string): Promise<string | null> {
    if (!UUID_RE.test(id)) return null;

    const byDoctorId = await this.doctorRepo.findOne({
      where: { id, approval_status: 'approved' },
      select: ['id'],
    });
    if (byDoctorId) return `/doctor/${byDoctorId.id}`;

    const byUserId = await this.doctorRepo.findOne({
      where: { user_id: id, approval_status: 'approved' },
      select: ['id'],
    });
    if (byUserId) return `/doctor/${byUserId.id}`;

    return null;
  }

  private async isAccessibleMedicalRecord(
    id: string,
    patientIds: string[],
  ): Promise<boolean> {
    if (!UUID_RE.test(id) || !patientIds.length) return false;

    const [diagnosis, document, prescription] = await Promise.all([
      this.diagnosisRepo.findOne({
        where: { id, patient_id: In(patientIds) },
        select: ['id'],
      }),
      this.docRepo.findOne({
        where: { id, patient_id: In(patientIds) },
        select: ['id'],
      }),
      this.prescriptionRepo.findOne({
        where: { id, patient_user_id: In(patientIds) },
        select: ['id'],
      }),
    ]);

    return !!(diagnosis || document || prescription);
  }

  private async resolveAccessiblePatientIds(user: AiContextUser): Promise<string[]> {
    if (user.role === UserRole.PATIENT) {
      const scope = user.patientContextId ?? user.id;
      return scope ? [scope] : [];
    }

    const doctor = await this.doctorRepo.findOne({
      where: { user_id: user.id },
      select: ['id'],
    });
    if (!doctor) return [];

    if (user.patientContextId) {
      const access = await this.accessRepo.findOne({
        where: {
          doctor_id: doctor.id,
          patient_user_id: user.patientContextId,
          records_allowed: true,
          blocked_by_patient: false,
          blocked_by_doctor: false,
        },
        select: ['patient_user_id'],
      });
      return access ? [user.patientContextId] : [];
    }

    const rows = await this.accessRepo.find({
      where: {
        doctor_id: doctor.id,
        records_allowed: true,
        blocked_by_patient: false,
        blocked_by_doctor: false,
      },
      select: ['patient_user_id'],
    });
    return rows.map((row) => row.patient_user_id);
  }

  private async stripBareInvalidPaths(
    text: string,
    user: AiContextUser,
    patientIds: string[],
    cache: Map<string, string | null>,
  ): Promise<string> {
    const barePathRe = /(^|[\s(])(\/(?:medical|doctor)\/[0-9a-f-]+)/gi;
    let next = text;

    for (const match of text.matchAll(barePathRe)) {
      const [full, prefix, rawPath] = match;
      const normalized = this.normalizePath(rawPath);
      if (full.includes('](')) continue;

      let validPath = cache.get(normalized);
      if (validPath === undefined) {
        validPath = await this.resolveValidPath(normalized, user, patientIds);
        cache.set(normalized, validPath);
      }

      if (!validPath) {
        next = next.replace(full, prefix);
      } else if (validPath !== normalized) {
        next = next.replace(rawPath, validPath);
      }
    }

    return next;
  }
}
