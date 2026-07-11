import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Appointment } from '../../../entities/appointment.entity';
import { Doctor } from '../../../entities/doctor.entity';
import { UserRole } from '../../../entities/user.entity';
import type { AIContextSource } from '../ai-context-source.interface';
import type { AiContextUser, AiIntent } from '../ai-context.types';

interface AppointmentCtx {
  date: string;
  time: string | null;
  status: string;
  meetingLink: string | null;
  counterpart: string;
}

const APPT_KEYWORDS =
  /appointment|appointments|booking|booked|meeting|schedule|scheduled|visit|session|موعد|مواعيد|ميعاد|حجز|زيارة|اجتماع/i;

@Injectable()
export class AppointmentsContextSource implements AIContextSource {
  readonly name = 'appointments';

  constructor(
    @InjectRepository(Appointment)
    private readonly appointmentRepo: Repository<Appointment>,
    @InjectRepository(Doctor)
    private readonly doctorRepo: Repository<Doctor>,
  ) {}

  canHandle(question: string, intent: AiIntent): boolean {
    return (
      APPT_KEYWORDS.test(question) ||
      intent === 'mixed_question' ||
      intent === 'patient_profile_question' ||
      intent === 'doctor_practice_question' ||
      intent === 'doctor_recommendation_question'
    );
  }

  private async loadFor(user: AiContextUser): Promise<Appointment[]> {
    if (user.role === UserRole.DOCTOR) {
      const doctor = await this.doctorRepo.findOne({
        where: { user_id: user.id },
        select: ['id'],
      });
      if (!doctor) return [];
      return this.appointmentRepo.find({
        where: { doctor_id: doctor.id },
        order: { date: 'DESC', time: 'DESC' },
        take: 60,
      });
    }
    const patientId = user.patientContextId ?? user.id;
    if (!patientId) return [];
    return this.appointmentRepo.find({
      where: { patient_user_id: patientId },
      order: { date: 'DESC', time: 'DESC' },
      take: 60,
    });
  }

  async fetchContext(user: AiContextUser): Promise<AppointmentCtx[]> {
    const rows = await this.loadFor(user);
    const isDoctor = user.role === UserRole.DOCTOR;
    return rows.map((a) => ({
      date: a.date,
      time: a.time,
      status: a.status,
      meetingLink: a.meeting_link,
      counterpart: isDoctor
        ? `patient ${a.patient_name || a.patient?.name || 'Unknown'}`
        : `Dr ${a.doctor?.name || 'Unknown'}`,
    }));
  }

  buildContextText(data: unknown): string {
    const rows = data as AppointmentCtx[];
    if (!rows?.length) {
      return '[Appointments]\nNo appointments found for this user.';
    }
    const lines = [
      '[Appointments — every appointment for this user, ALL statuses (pending, confirmed, waiting, active, done, cancelled, rejected). Use for questions about appointment times, status, and meeting links.]',
    ];
    for (const a of rows) {
      const when = a.time ? `${a.date} at ${a.time}` : a.date;
      const link = a.meetingLink
        ? `Meeting link: ${a.meetingLink}`
        : 'Meeting link: not available yet';
      lines.push(`- ${when} | Status: ${a.status} | with ${a.counterpart} | ${link}`);
    }
    return lines.join('\n');
  }

  async getVersionKey(user: AiContextUser): Promise<string> {
    const scopeId =
      user.role === UserRole.DOCTOR ? user.id : user.patientContextId ?? user.id;
    const rows = await this.loadFor(user);
    const max = rows.reduce(
      (m, r) => Math.max(m, r.updated_at?.getTime() ?? 0),
      0,
    );
    return `appts:${scopeId}:${rows.length}:${max}`;
  }
}
