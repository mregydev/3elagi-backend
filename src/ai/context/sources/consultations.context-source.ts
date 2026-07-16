import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Consultation } from '../../../entities/consultation.entity';
import { Diagnosis } from '../../../entities/diagnosis.entity';
import { Doctor } from '../../../entities/doctor.entity';
import { DoctorPatientAccess } from '../../../entities/doctor-patient-access.entity';
import { PatientProfile } from '../../../entities/patient-profile.entity';
import { UserRole } from '../../../entities/user.entity';
import type { AIContextSource } from '../ai-context-source.interface';
import type { AiContextUser, AiIntent } from '../ai-context.types';

interface ConsultationCtx {
  id: string;
  patientUserId: string;
  patientName: string;
  doctorUserId: string;
  doctorName: string;
  status: string;
  description: string;
  doctorNote: string | null;
  diagnosisId: string | null;
  diagnosisDesc: string | null;
  cancelReason: string | null;
  createdAt: string;
  closedAt: string | null;
}

interface ConsultationsPayload {
  scopedPatientId: string | null;
  consultations: ConsultationCtx[];
}

const CONSULT_KEYWORDS =
  /consultation|consult|visit|session|استشار|جلسه|جلسة|معاينه|معاينة|زيارة/i;

@Injectable()
export class ConsultationsContextSource implements AIContextSource {
  readonly name = 'consultations';

  constructor(
    @InjectRepository(Consultation)
    private readonly consultationRepo: Repository<Consultation>,
    @InjectRepository(DoctorPatientAccess)
    private readonly accessRepo: Repository<DoctorPatientAccess>,
    @InjectRepository(Doctor)
    private readonly doctorRepo: Repository<Doctor>,
    @InjectRepository(PatientProfile)
    private readonly profileRepo: Repository<PatientProfile>,
    @InjectRepository(Diagnosis)
    private readonly diagnosisRepo: Repository<Diagnosis>,
  ) {}

  canHandle(question: string, intent: AiIntent): boolean {
    return (
      CONSULT_KEYWORDS.test(question) ||
      intent === 'doctor_practice_question' ||
      intent === 'medical_record_question' ||
      intent === 'mixed_question' ||
      intent === 'patient_profile_question'
    );
  }

  async fetchContext(user: AiContextUser): Promise<ConsultationsPayload | null> {
    if (user.role === UserRole.DOCTOR) {
      return this.fetchForDoctor(user);
    }
    if (user.role === UserRole.PATIENT) {
      return this.fetchForPatient(user);
    }
    return null;
  }

  private async fetchForDoctor(
    user: AiContextUser,
  ): Promise<ConsultationsPayload | null> {
    const doctor = await this.doctorRepo.findOne({
      where: { user_id: user.id },
      select: ['id'],
    });
    if (!doctor) return null;

    const accessRows = await this.accessRepo.find({
      where: {
        doctor_id: doctor.id,
        blocked_by_patient: false,
        blocked_by_doctor: false,
        records_allowed: true,
      },
    });
    let allowedPatientIds = accessRows.map((r) => r.patient_user_id);
    if (!allowedPatientIds.length) {
      return { scopedPatientId: null, consultations: [] };
    }

    const scoped = user.patientContextId?.trim() || null;
    if (scoped) {
      if (!allowedPatientIds.includes(scoped)) {
        return { scopedPatientId: scoped, consultations: [] };
      }
      allowedPatientIds = [scoped];
    }

    const rows = await this.consultationRepo.find({
      where: { patient_id: In(allowedPatientIds) },
      order: { created_at: 'DESC' },
      take: 80,
    });

    return {
      scopedPatientId: scoped,
      consultations: await this.mapRows(rows),
    };
  }

  private async fetchForPatient(
    user: AiContextUser,
  ): Promise<ConsultationsPayload | null> {
    const patientId = user.patientContextId ?? user.id;
    const rows = await this.consultationRepo.find({
      where: { patient_id: patientId },
      order: { created_at: 'DESC' },
      take: 40,
    });
    return {
      scopedPatientId: patientId,
      consultations: await this.mapRows(rows),
    };
  }

  private async mapRows(rows: Consultation[]): Promise<ConsultationCtx[]> {
    if (!rows.length) return [];

    const patientIds = [...new Set(rows.map((r) => r.patient_id))];
    const doctorUserIds = [...new Set(rows.map((r) => r.doctor_id))];
    const diagnosisIds = [
      ...new Set(rows.map((r) => r.diagnosis_id).filter(Boolean) as string[]),
    ];

    const [profiles, doctors, diagnoses] = await Promise.all([
      this.profileRepo.find({ where: { user_id: In(patientIds) } }),
      this.doctorRepo.find({ where: { user_id: In(doctorUserIds) } }),
      diagnosisIds.length
        ? this.diagnosisRepo.find({ where: { id: In(diagnosisIds) } })
        : Promise.resolve([] as Diagnosis[]),
    ]);

    const profileById = new Map(profiles.map((p) => [p.user_id, p]));
    const doctorByUserId = new Map(doctors.map((d) => [d.user_id, d]));
    const diagnosisById = new Map(diagnoses.map((d) => [d.id, d]));

    return rows.map((c) => {
      const profile = profileById.get(c.patient_id);
      const doctor = doctorByUserId.get(c.doctor_id);
      const diagnosis = c.diagnosis_id
        ? diagnosisById.get(c.diagnosis_id)
        : undefined;
      return {
        id: c.id,
        patientUserId: c.patient_id,
        patientName: profile?.name ?? 'Unknown patient',
        doctorUserId: c.doctor_id,
        doctorName: doctor?.name ? `Dr ${doctor.name}` : 'Doctor',
        status: c.status,
        description: c.description?.trim() || '',
        doctorNote: c.doctor_note?.trim() || null,
        diagnosisId: c.diagnosis_id,
        diagnosisDesc: diagnosis?.desc?.trim() || null,
        cancelReason: c.cancel_reason?.trim() || null,
        createdAt: c.created_at?.toISOString?.() ?? String(c.created_at),
        closedAt: c.closed_at?.toISOString?.() ?? null,
      };
    });
  }

  buildContextText(data: unknown): string {
    const payload = data as ConsultationsPayload | null;
    if (!payload) return '';

    const rows = payload.consultations ?? [];
    if (!rows.length) {
      return [
        '[Patient consultations]',
        'No consultations found for authorized patients in scope.',
      ].join('\n');
    }

    const lines: string[] = [
      '[Patient consultations — ALWAYS consider these when answering about a patient. Prefer the LAST consultation for the most recent clinical context, then earlier consultations for history.]',
    ];

    if (payload.scopedPatientId || new Set(rows.map((r) => r.patientUserId)).size === 1) {
      const last = rows[0];
      lines.push('', '[Last consultation — prioritize this]');
      lines.push(this.formatRow(last, true));
      if (rows.length > 1) {
        lines.push('', '[Earlier consultations — newest first]');
        for (const row of rows.slice(1)) {
          lines.push(this.formatRow(row, false));
        }
      }
    } else {
      // Multi-patient: highlight each patient's most recent consult, then full list.
      const seen = new Set<string>();
      const lasts: ConsultationCtx[] = [];
      for (const row of rows) {
        if (seen.has(row.patientUserId)) continue;
        seen.add(row.patientUserId);
        lasts.push(row);
      }
      lines.push('', '[Last consultation per patient — prioritize these]');
      for (const row of lasts) {
        lines.push(this.formatRow(row, true));
      }
      lines.push('', '[All consultations — newest first]');
      for (const row of rows) {
        lines.push(this.formatRow(row, false));
      }
    }

    return lines.join('\n');
  }

  private formatRow(c: ConsultationCtx, emphasize: boolean): string {
    const parts = [
      emphasize ? '★' : '-',
      `Patient: ${c.patientName}`,
      `Doctor: ${c.doctorName}`,
      `Status: ${c.status}`,
      `Started: ${c.createdAt.slice(0, 10)}`,
    ];
    if (c.closedAt) parts.push(`Closed: ${c.closedAt.slice(0, 10)}`);
    const detail: string[] = [parts.join(' | ')];
    if (c.description) detail.push(`  Reason/description: ${c.description}`);
    if (c.doctorNote) detail.push(`  Doctor note: ${c.doctorNote}`);
    if (c.diagnosisDesc) detail.push(`  Linked diagnosis: ${c.diagnosisDesc}`);
    if (c.cancelReason) detail.push(`  Cancel reason: ${c.cancelReason}`);
    return detail.join('\n');
  }

  async getVersionKey(user: AiContextUser): Promise<string> {
    const payload = await this.fetchContext(user);
    const rows = payload?.consultations ?? [];
    const max = rows.reduce((m, r) => {
      const t = Date.parse(r.closedAt ?? r.createdAt) || 0;
      return Math.max(m, t);
    }, 0);
    const scope =
      user.patientContextId ??
      (user.role === UserRole.DOCTOR ? user.id : user.id);
    return `consults:${scope}:${rows.length}:${max}`;
  }
}
