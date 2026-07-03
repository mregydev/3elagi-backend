import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThanOrEqual, MoreThanOrEqual, Not, Repository } from 'typeorm';
import { DoctorSchedule } from '../entities/doctor-schedule.entity';
import {
  DoctorScheduleOverride,
  ScheduleOverrideScope,
} from '../entities/doctor-schedule-override.entity';
import { Doctor } from '../entities/doctor.entity';
import {
  Appointment,
  AppointmentStatus,
} from '../entities/appointment.entity';

interface ScheduleInput {
  day_of_week: number;
  start_time: string;
  end_time: string;
  slot_minutes: number;
  is_active?: boolean;
}

interface OverrideInput {
  id?: string;
  scope: ScheduleOverrideScope;
  start_date: string;
  end_date: string;
  is_closed: boolean;
  start_time?: string | null;
  end_time?: string | null;
  slot_minutes?: number | null;
  note?: string | null;
}

const VALID_SCOPES: ScheduleOverrideScope[] = ['day', 'week', 'month'];
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map((s) => parseInt(s, 10));
  return h * 60 + m;
}

function minutesToTime(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function normalizeTime(t: string): string {
  return t.length === 5 ? `${t}:00` : t;
}

function localDateYmd(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isFutureSlot(dateStr: string, time: string, now = new Date()): boolean {
  const slotAt = new Date(`${dateStr}T${time}:00`);
  return slotAt.getTime() > now.getTime();
}

@Injectable()
export class SchedulesService {
  constructor(
    @InjectRepository(DoctorSchedule)
    private scheduleRepo: Repository<DoctorSchedule>,
    @InjectRepository(DoctorScheduleOverride)
    private overrideRepo: Repository<DoctorScheduleOverride>,
    @InjectRepository(Doctor) private doctorRepo: Repository<Doctor>,
    @InjectRepository(Appointment)
    private appointmentRepo: Repository<Appointment>,
  ) {}

  private async getDoctor(userId: string): Promise<Doctor> {
    const doctor = await this.doctorRepo.findOne({ where: { user_id: userId } });
    if (!doctor) throw new ForbiddenException('Doctor profile not found');
    return doctor;
  }

  // ── Weekly schedule ─────────────────────────────────────────────────
  async listMine(userId: string): Promise<DoctorSchedule[]> {
    const doctor = await this.getDoctor(userId);
    return this.scheduleRepo.find({
      where: { doctor_id: doctor.id },
      order: { day_of_week: 'ASC', start_time: 'ASC' },
    });
  }

  async replaceMine(
    userId: string,
    items: ScheduleInput[],
  ): Promise<DoctorSchedule[]> {
    const doctor = await this.getDoctor(userId);
    if (!Array.isArray(items)) {
      throw new BadRequestException('items must be an array');
    }
    const cleaned = items.map((i, idx) => {
      const day = Number(i.day_of_week);
      const slot = Number(i.slot_minutes);
      if (!Number.isInteger(day) || day < 0 || day > 6) {
        throw new BadRequestException(`row ${idx}: day_of_week must be 0–6`);
      }
      if (
        typeof i.start_time !== 'string' ||
        typeof i.end_time !== 'string' ||
        !TIME_RE.test(i.start_time) ||
        !TIME_RE.test(i.end_time)
      ) {
        throw new BadRequestException(`row ${idx}: start/end time must be HH:mm`);
      }
      const s = timeToMinutes(i.start_time);
      const e = timeToMinutes(i.end_time);
      if (e <= s) {
        throw new BadRequestException(`row ${idx}: end_time must be after start_time`);
      }
      if (!Number.isInteger(slot) || slot < 5 || slot > 240) {
        throw new BadRequestException(`row ${idx}: slot_minutes must be 5–240`);
      }
      return {
        doctor_id: doctor.id,
        day_of_week: day,
        start_time: normalizeTime(i.start_time),
        end_time: normalizeTime(i.end_time),
        slot_minutes: slot,
        is_active: i.is_active !== false,
      };
    });
    await this.scheduleRepo.delete({ doctor_id: doctor.id });
    if (cleaned.length === 0) return [];
    const saved = await this.scheduleRepo.save(
      cleaned.map((c) => this.scheduleRepo.create(c)),
    );
    return saved;
  }

  // ── Date overrides (day / week / month) ─────────────────────────────
  async listMyOverrides(userId: string): Promise<DoctorScheduleOverride[]> {
    const doctor = await this.getDoctor(userId);
    return this.overrideRepo.find({
      where: { doctor_id: doctor.id },
      order: { start_date: 'ASC' },
    });
  }

  async replaceMyOverrides(
    userId: string,
    items: OverrideInput[],
  ): Promise<DoctorScheduleOverride[]> {
    const doctor = await this.getDoctor(userId);
    if (!Array.isArray(items)) {
      throw new BadRequestException('items must be an array');
    }
    const cleaned = items.map((i, idx) => {
      if (!VALID_SCOPES.includes(i.scope)) {
        throw new BadRequestException(`row ${idx}: scope must be day|week|month`);
      }
      if (!DATE_RE.test(i.start_date) || !DATE_RE.test(i.end_date)) {
        throw new BadRequestException(`row ${idx}: dates must be YYYY-MM-DD`);
      }
      if (i.end_date < i.start_date) {
        throw new BadRequestException(`row ${idx}: end_date must be ≥ start_date`);
      }
      const isClosed = !!i.is_closed;
      let startTime: string | null = null;
      let endTime: string | null = null;
      let slot: number | null = null;
      if (!isClosed) {
        if (
          typeof i.start_time !== 'string' ||
          typeof i.end_time !== 'string' ||
          !TIME_RE.test(i.start_time) ||
          !TIME_RE.test(i.end_time)
        ) {
          throw new BadRequestException(
            `row ${idx}: open overrides need start_time/end_time HH:mm`,
          );
        }
        const s = timeToMinutes(i.start_time);
        const e = timeToMinutes(i.end_time);
        if (e <= s) {
          throw new BadRequestException(
            `row ${idx}: end_time must be after start_time`,
          );
        }
        slot = Number(i.slot_minutes);
        if (!Number.isInteger(slot) || slot < 5 || slot > 240) {
          throw new BadRequestException(
            `row ${idx}: slot_minutes must be 5–240`,
          );
        }
        startTime = normalizeTime(i.start_time);
        endTime = normalizeTime(i.end_time);
      }
      return {
        doctor_id: doctor.id,
        scope: i.scope,
        start_date: i.start_date,
        end_date: i.end_date,
        is_closed: isClosed,
        start_time: startTime,
        end_time: endTime,
        slot_minutes: slot,
        note: typeof i.note === 'string' ? i.note.slice(0, 200) : null,
      };
    });
    await this.overrideRepo.delete({ doctor_id: doctor.id });
    if (cleaned.length === 0) return [];
    return this.overrideRepo.save(
      cleaned.map((c) => this.overrideRepo.create(c)),
    );
  }

  // ── Slot computation honouring overrides ────────────────────────────
  async slotTimesForDate(doctorId: string, dateStr: string): Promise<string[]> {
    // Date overrides take precedence over weekly schedule
    const overrides = await this.overrideRepo.find({
      where: {
        doctor_id: doctorId,
        start_date: LessThanOrEqual(dateStr),
        end_date: MoreThanOrEqual(dateStr),
      },
    });

    if (overrides.length > 0) {
      // Any closed override → fully closed
      if (overrides.some((o) => o.is_closed)) return [];
      const set = new Set<string>();
      for (const o of overrides) {
        if (!o.start_time || !o.end_time || !o.slot_minutes) continue;
        const start = timeToMinutes(o.start_time);
        const end = timeToMinutes(o.end_time);
        for (let t = start; t + o.slot_minutes <= end; t += o.slot_minutes) {
          set.add(minutesToTime(t));
        }
      }
      return Array.from(set).sort();
    }

    // Fall back to weekly recurring schedule
    const day = new Date(`${dateStr}T00:00:00Z`).getUTCDay();
    const schedules = await this.scheduleRepo.find({
      where: { doctor_id: doctorId, day_of_week: day, is_active: true },
      order: { start_time: 'ASC' },
    });
    const set = new Set<string>();
    for (const s of schedules) {
      const start = timeToMinutes(s.start_time);
      const end = timeToMinutes(s.end_time);
      for (let t = start; t + s.slot_minutes <= end; t += s.slot_minutes) {
        set.add(minutesToTime(t));
      }
    }
    return Array.from(set).sort();
  }

  async availableSlots(
    doctorId: string,
    dateStr: string,
  ): Promise<{ time: string; taken: boolean }[]> {
    if (!DATE_RE.test(dateStr)) {
      throw new BadRequestException('date must be YYYY-MM-DD');
    }
    const doctor = await this.doctorRepo.findOne({ where: { id: doctorId } });
    if (!doctor || doctor.approval_status !== 'approved') {
      throw new NotFoundException('Doctor not found');
    }
    let slots = await this.slotTimesForDate(doctorId, dateStr);
    if (dateStr === localDateYmd()) {
      const now = new Date();
      slots = slots.filter((time) => isFutureSlot(dateStr, time, now));
    }
    const existing = await this.appointmentRepo.find({
      where: {
        doctor_id: doctorId,
        date: dateStr,
        status: Not(
          In([
            AppointmentStatus.CANCELLED,
            AppointmentStatus.REJECTED,
          ]),
        ),
      },
    });
    const taken = new Set(
      existing
        .map((a) => (a.time ? a.time.slice(0, 5) : null))
        .filter((x): x is string => !!x),
    );
    return slots.map((time) => ({ time, taken: taken.has(time) }));
  }
}
