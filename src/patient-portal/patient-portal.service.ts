import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, Repository } from 'typeorm';
import { Doctor } from '../entities/doctor.entity';
import { Clinic } from '../entities/clinic.entity';
import { PatientProfile } from '../entities/patient-profile.entity';
import { Patient } from '../entities/patient.entity';
import {
  Appointment,
  AppointmentStatus,
} from '../entities/appointment.entity';
import { IntakeTest } from '../entities/intake-test.entity';
import { SchedulesService } from '../schedules/schedules.service';

interface OnboardingDto {
  birth_date?: string | null;
  gender?: string | null;
  chronic_conditions?: string | null;
  allergies?: string | null;
  medical_notes?: string | null;
  photo_url?: string | null;
  intake_test_id?: string | null;
  intake_answers?: Record<string, string[]> | null;
}

interface ReservationDto {
  doctor_id: string;
  date: string;
  time: string;
  intake_test_id?: string | null;
  intake_answers?: Record<string, string[]> | null;
  hide_name?: boolean;
}

@Injectable()
export class PatientPortalService {
  constructor(
    @InjectRepository(Doctor) private doctorRepo: Repository<Doctor>,
    @InjectRepository(Clinic) private clinicRepo: Repository<Clinic>,
    @InjectRepository(PatientProfile)
    private profileRepo: Repository<PatientProfile>,
    @InjectRepository(Patient) private patientRepo: Repository<Patient>,
    @InjectRepository(Appointment)
    private appointmentRepo: Repository<Appointment>,
    @InjectRepository(IntakeTest)
    private intakeRepo: Repository<IntakeTest>,
    private schedulesService: SchedulesService,
  ) {}

  async listDoctors() {
    const doctors = await this.doctorRepo.find({
      where: { approval_status: 'approved' },
      order: { name: 'ASC' },
    });
    const clinicIds = Array.from(
      new Set(doctors.map((d) => d.default_clinic_id).filter((x): x is string => !!x)),
    );
    const clinics = clinicIds.length
      ? await this.clinicRepo.findByIds(clinicIds)
      : [];
    const clinicMap = new Map(clinics.map((c) => [c.id, c]));
    return doctors.map((d) => {
      const c = d.default_clinic_id ? clinicMap.get(d.default_clinic_id) : null;
      return {
        id: d.id,
        name: d.name,
        photo_url: d.photo_url,
        phone: d.phone,
        professional_title: d.professional_title,
        description: d.description,
        experience_years: d.experience_years,
        consultation_fee_egp: d.consultation_fee_egp,
        tags: Array.isArray(d.tags) ? d.tags : [],
        clinic: c
          ? {
              id: c.id,
              name: c.name,
              location: c.location,
              logo_url: c.logo_url,
            }
          : null,
      };
    });
  }

  async getDoctor(id: string) {
    const doctor = await this.doctorRepo.findOne({ where: { id } });
    if (!doctor) throw new NotFoundException('Doctor not found');
    if (doctor.approval_status !== 'approved') {
      throw new NotFoundException('Doctor not found');
    }
    const clinic = doctor.default_clinic_id
      ? await this.clinicRepo.findOne({ where: { id: doctor.default_clinic_id } })
      : null;
    let intake = await this.intakeRepo.findOne({
      where: { doctor_id: doctor.id, is_active: true },
      order: { updated_at: 'DESC' },
    });
    if (!intake) {
      intake = await this.intakeRepo.findOne({
        where: { is_default_template: true, is_active: true },
      });
    }
    return {
      id: doctor.id,
      name: doctor.name,
      photo_url: doctor.photo_url,
      phone: doctor.phone,
      age: doctor.age,
      professional_title: doctor.professional_title,
      description: doctor.description,
      experience_years: doctor.experience_years,
      consultation_fee_egp: doctor.consultation_fee_egp,
      faqs: Array.isArray(doctor.faqs) ? doctor.faqs : [],
      tags: Array.isArray(doctor.tags) ? doctor.tags : [],
      clinic: clinic
        ? {
            id: clinic.id,
            name: clinic.name,
            location: clinic.location,
            phone: clinic.phone,
            logo_url: clinic.logo_url,
          }
        : null,
      active_intake_test: intake
        ? {
            id: intake.id,
            name: intake.name,
            description: intake.description,
            questions: intake.questions,
          }
        : null,
    };
  }

  async getMe(userId: string) {
    const profile = await this.profileRepo.findOne({ where: { user_id: userId } });
    if (!profile) throw new NotFoundException('Patient profile not found');
    return profile;
  }

  async saveOnboarding(userId: string, dto: OnboardingDto) {
    const profile = await this.getMe(userId);
    if (dto.birth_date !== undefined) profile.birth_date = dto.birth_date;
    if (dto.gender !== undefined) profile.gender = dto.gender;
    if (dto.chronic_conditions !== undefined) profile.chronic_conditions = dto.chronic_conditions;
    if (dto.allergies !== undefined) profile.allergies = dto.allergies;
    if (dto.medical_notes !== undefined) profile.medical_notes = dto.medical_notes;
    if (dto.photo_url !== undefined) profile.photo_url = dto.photo_url;
    if (dto.intake_test_id !== undefined) profile.intake_test_id = dto.intake_test_id;
    if (dto.intake_answers !== undefined) {
      profile.intake_answers = (dto.intake_answers || {}) as Record<string, string[]>;
    }
    profile.onboarded_at = new Date();
    return this.profileRepo.save(profile);
  }

  async getOnboardingIntake() {
    const tpl = await this.intakeRepo.findOne({
      where: { is_default_template: true, is_active: true },
    });
    if (!tpl) return null;
    return {
      id: tpl.id,
      name: tpl.name,
      description: tpl.description,
      questions: tpl.questions,
    };
  }

  private async upsertClinicPatient(
    profile: PatientProfile,
    clinicId: string,
  ): Promise<Patient> {
    const existing = await this.patientRepo.findOne({
      where: { phone: profile.phone, clinic_id: clinicId },
    });
    if (existing) {
      let dirty = false;
      if (profile.name && existing.name !== profile.name) {
        existing.name = profile.name;
        dirty = true;
      }
      if (profile.birth_date && existing.birth_date !== profile.birth_date) {
        existing.birth_date = profile.birth_date;
        dirty = true;
      }
      if (profile.photo_url && existing.photo_url !== profile.photo_url) {
        existing.photo_url = profile.photo_url;
        dirty = true;
      }
      if (dirty) await this.patientRepo.save(existing);
      return existing;
    }
    const created = this.patientRepo.create({
      clinic_id: clinicId,
      name: profile.name,
      phone: profile.phone,
      birth_date: profile.birth_date ?? undefined,
      photo_url: profile.photo_url ?? null,
    });
    return this.patientRepo.save(created);
  }

  async createReservation(userId: string, dto: ReservationDto) {
    if (!dto?.doctor_id || !dto?.date || !dto?.time) {
      throw new BadRequestException('doctor_id, date and time are required');
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dto.date)) {
      throw new BadRequestException('date must be YYYY-MM-DD');
    }
    if (typeof dto.time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(dto.time)) {
      throw new BadRequestException('time must be HH:mm');
    }
    const profile = await this.getMe(userId);
    const doctor = await this.doctorRepo.findOne({ where: { id: dto.doctor_id } });
    if (!doctor || doctor.approval_status !== 'approved') {
      throw new NotFoundException('Doctor not found');
    }
    if (!doctor.default_clinic_id) {
      throw new BadRequestException('Doctor has no clinic configured');
    }

    // Verify the requested slot exists in the doctor's published schedule
    const validSlots = await this.schedulesService.slotTimesForDate(
      doctor.id,
      dto.date,
    );
    if (!validSlots.includes(dto.time)) {
      throw new BadRequestException('Selected time slot is not available');
    }

    const time = `${dto.time}:00`;
    const conflict = await this.appointmentRepo.findOne({
      where: {
        doctor_id: doctor.id,
        date: dto.date,
        time,
        status: Not(In([AppointmentStatus.CANCELLED, AppointmentStatus.REJECTED])),
      },
    });
    if (conflict) throw new BadRequestException('Time slot already booked');

    const patient = await this.upsertClinicPatient(
      profile,
      doctor.default_clinic_id,
    );

    let intakeTestId: string | null = null;
    let intakeAnswers: Record<string, string[]> | null = null;
    // If doctor has an active intake test, require it
    let activeIntake = await this.intakeRepo.findOne({
      where: { doctor_id: doctor.id, is_active: true },
      order: { updated_at: 'DESC' },
    });
    if (!activeIntake) {
      activeIntake = await this.intakeRepo.findOne({
        where: { is_default_template: true, is_active: true },
      });
    }
    if (activeIntake) {
      if (!dto.intake_test_id || dto.intake_test_id !== activeIntake.id) {
        throw new BadRequestException('Active intake test must be answered');
      }
      const answers =
        dto.intake_answers && typeof dto.intake_answers === 'object'
          ? dto.intake_answers
          : {};
      for (const q of activeIntake.questions || []) {
        const got = (answers as Record<string, string[]>)[q.id];
        if (q.required && (!Array.isArray(got) || got.length === 0)) {
          throw new BadRequestException(`Question ${q.id} is required`);
        }
      }
      intakeTestId = activeIntake.id;
      intakeAnswers = answers as Record<string, string[]>;
    } else if (dto.intake_test_id) {
      // Doctor has no active intake but client sent one — ignore silently
      intakeTestId = null;
      intakeAnswers = null;
    }

    const count = await this.appointmentRepo.count({
      where: { doctor_id: doctor.id, date: dto.date },
    });

    const appt = this.appointmentRepo.create({
      clinic_id: doctor.default_clinic_id,
      doctor_id: doctor.id,
      patient_id: patient.id,
      patient_name: profile.name,
      patient_phone: profile.phone,
      date: dto.date,
      time,
      status: AppointmentStatus.PENDING,
      queue_position: count + 1,
      intake_test_id: intakeTestId,
      intake_answers: intakeAnswers,
      booked_via_app: true,
      patient_user_id: userId,
      hide_name: dto.hide_name === true,
    });
    return this.appointmentRepo.save(appt);
  }

  async setHideName(userId: string, apptId: string, hide: boolean) {
    const appt = await this.appointmentRepo.findOne({ where: { id: apptId } });
    if (!appt) throw new NotFoundException('Reservation not found');
    if (appt.patient_user_id !== userId) {
      throw new ForbiddenException('Not your reservation');
    }
    appt.hide_name = !!hide;
    await this.appointmentRepo.save(appt);
    return { id: appt.id, hide_name: appt.hide_name };
  }

  async myReservations(userId: string) {
    const appts = await this.appointmentRepo.find({
      where: { patient_user_id: userId },
      order: { date: 'DESC', time: 'DESC' },
    });
    const doctorIds = Array.from(
      new Set(appts.map((a) => a.doctor_id).filter((x): x is string => !!x)),
    );
    const clinicIds = Array.from(new Set(appts.map((a) => a.clinic_id)));
    const [doctors, clinics] = await Promise.all([
      doctorIds.length ? this.doctorRepo.findByIds(doctorIds) : Promise.resolve([]),
      clinicIds.length ? this.clinicRepo.findByIds(clinicIds) : Promise.resolve([]),
    ]);
    const dmap = new Map(doctors.map((d) => [d.id, d]));
    const cmap = new Map(clinics.map((c) => [c.id, c]));
    // Patient-facing status is reduced to 3 buckets:
    //   pending   — booked, awaiting doctor approval
    //   confirmed — doctor approved (covers internal waiting/active/done)
    //   rejected  — doctor declined (covers cancelled too)
    const patientStatus = (s: AppointmentStatus): 'pending' | 'confirmed' | 'rejected' => {
      if (s === AppointmentStatus.PENDING) return 'pending';
      if (s === AppointmentStatus.REJECTED || s === AppointmentStatus.CANCELLED) return 'rejected';
      return 'confirmed';
    };
    return appts.map((a) => ({
      id: a.id,
      date: a.date,
      time: a.time,
      status: patientStatus(a.status),
      hide_name: a.hide_name,
      doctor: a.doctor_id
        ? {
            id: a.doctor_id,
            name: dmap.get(a.doctor_id)?.name ?? null,
          }
        : null,
      clinic: cmap.get(a.clinic_id)
        ? {
            id: a.clinic_id,
            name: cmap.get(a.clinic_id)!.name,
            location: cmap.get(a.clinic_id)!.location,
          }
        : null,
    }));
  }
}
