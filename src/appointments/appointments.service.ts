import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, MoreThanOrEqual, Repository, Brackets } from 'typeorm';
import {
  Appointment,
  AppointmentStatus,
} from '../entities/appointment.entity';
import { Doctor } from '../entities/doctor.entity';
import { Patient } from '../entities/patient.entity';
import { Clinic } from '../entities/clinic.entity';
import { IntakeTest } from '../entities/intake-test.entity';
import { Message } from '../entities/message.entity';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import {
  deleteAppointmentActionMessages,
  existingAppointmentIds,
} from './appointment-chat-messages';

function localDateYmd(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

@Injectable()
export class AppointmentsService {
  constructor(
    @InjectRepository(Appointment)
    private appointmentRepo: Repository<Appointment>,
    @InjectRepository(Doctor) private doctorRepo: Repository<Doctor>,
    @InjectRepository(Patient) private patientRepo: Repository<Patient>,
    @InjectRepository(Clinic) private clinicRepo: Repository<Clinic>,
    @InjectRepository(IntakeTest) private intakeRepo: Repository<IntakeTest>,
    @InjectRepository(Message) private messageRepo: Repository<Message>,
  ) {}

  /** Appointment ids referenced in chat that still exist in the DB. */
  private async chatLinkedAppointmentIds(userId: string): Promise<string[]> {
    const rows = await this.messageRepo
      .createQueryBuilder('m')
      .select("DISTINCT m.attachment_meta->>'appointment_id'", 'appointment_id')
      .where('m.type = :type', { type: 'appointment_action' })
      .andWhere('(m.creator = :userId OR m.recipient = :userId)', { userId })
      .andWhere("m.attachment_meta->>'appointment_id' IS NOT NULL")
      .getRawMany<{ appointment_id: string }>();

    const ids = rows.map((row) => row.appointment_id).filter(Boolean);
    return [...(await existingAppointmentIds(this.appointmentRepo, ids))];
  }

  async findByClinicAndDate(clinicId: string, date: string) {
    const appointments = await this.appointmentRepo.find({
      where: { clinic_id: clinicId, date },
      order: { queue_position: 'ASC', created_at: 'ASC' },
    });

    const grouped: Record<string, { doctor: Doctor | null; appointments: Appointment[] }> = {};
    for (const appt of appointments) {
      if (!grouped[appt.doctor_id]) {
        grouped[appt.doctor_id] = {
          doctor: appt.doctor,
          appointments: [],
        };
      }
      grouped[appt.doctor_id].appointments.push(appt);
    }

    return Object.values(grouped);
  }

  async getQueueForDoctor(doctorId: string, date: string) {
    const appointments = await this.appointmentRepo.find({
      where: { doctor_id: doctorId, date },
      order: { queue_position: 'ASC', created_at: 'ASC' },
    });

    return appointments.filter(
      (a) =>
        a.status !== AppointmentStatus.DONE &&
        a.status !== AppointmentStatus.CANCELLED,
    );
  }

  async getClinicQueueScreen(clinicId: string) {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;

    const doctors = await this.doctorRepo.find({
      where: { default_clinic_id: clinicId },
    });

    const inWindow = (timeStr: string | null): boolean => {
      if (!timeStr) return true; // walk-ins (no time) always shown
      const [h, m] = timeStr.split(':').map((n) => parseInt(n, 10));
      if (Number.isNaN(h) || Number.isNaN(m)) return true;
      const apptDate = new Date(now);
      apptDate.setHours(h, m, 0, 0);
      const diff = apptDate.getTime() - now.getTime();
      // show if appointment is in the past today (could still be waiting),
      // or up to 4 hours in the future
      return diff <= FOUR_HOURS_MS;
    };

    const display = (a: Appointment, idx: number): string => {
      if (a.hide_name) return `#${idx + 1}`;
      return a.patient?.name ?? a.patient_name ?? a.patient_phone ?? `#${idx + 1}`;
    };

    const perDoctor = await Promise.all(
      doctors.map(async (doctor) => {
        const all = await this.appointmentRepo.find({
          where: { doctor_id: doctor.id, date: today },
          order: { queue_position: 'ASC', created_at: 'ASC' },
        });
        // Active appointments are always relevant; waiting filtered by 4h window
        const queue = all.filter(
          (a) =>
            a.status === AppointmentStatus.ACTIVE ||
            (a.status === AppointmentStatus.WAITING && inWindow(a.time)),
        );
        const active = queue.find((a) => a.status === AppointmentStatus.ACTIVE);
        const waiting = queue.filter(
          (a) => a.status === AppointmentStatus.WAITING,
        );
        const nextWaiting = waiting[0];

        return {
          doctor: { id: doctor.id, name: doctor.name },
          current_patient: active
            ? display(active, 0)
            : null,
          next_patient: nextWaiting
            ? display(nextWaiting, 0)
            : null,
          waiting_list: waiting.map((a, i) => ({
            id: a.id,
            position: a.queue_position,
            label: display(a, i),
            time: a.time,
            hide_name: a.hide_name,
          })),
        };
      }),
    );

    return perDoctor;
  }

  async create(dto: CreateAppointmentDto) {
    const clinic = await this.clinicRepo.findOne({ where: { id: dto.clinic_id } });
    if (!clinic) throw new NotFoundException('Clinic not found');

    if (dto.doctor_id) {
      const doctor = await this.doctorRepo.findOne({ where: { id: dto.doctor_id } });
      if (!doctor) throw new NotFoundException('Doctor not found');
      if (doctor.default_clinic_id !== dto.clinic_id) {
        throw new ForbiddenException('Doctor does not belong to this clinic');
      }
    }

    let patientId = dto.patient_id ?? null;

    if (!patientId && dto.patient_phone) {
      const existing = await this.patientRepo.findOne({
        where: { phone: dto.patient_phone, clinic_id: dto.clinic_id },
      });

      if (existing) {
        patientId = existing.id;
      } else if (dto.patient_name) {
        const newPatient = this.patientRepo.create({
          phone: dto.patient_phone,
          name: dto.patient_name,
          clinic_id: dto.clinic_id,
        });
        const saved = await this.patientRepo.save(newPatient);
        patientId = saved.id;
      }
    }

    const count = await this.appointmentRepo.count({
      where: { doctor_id: dto.doctor_id, date: dto.date },
    });

    const appointment = this.appointmentRepo.create({
      clinic_id: dto.clinic_id,
      doctor_id: dto.doctor_id,
      patient_id: patientId ?? undefined,
      patient_name: dto.patient_name,
      patient_phone: dto.patient_phone,
      date: dto.date,
      time: dto.time,
      status: AppointmentStatus.WAITING,
      queue_position: count + 1,
    });
    return this.appointmentRepo.save(appointment);
  }

  async updateStatus(id: string, status: AppointmentStatus) {
    const appt = await this.appointmentRepo.findOne({ where: { id } });
    if (!appt) throw new NotFoundException('Appointment not found');
    appt.status = status;
    return this.appointmentRepo.save(appt);
  }

  async callNextPatient(doctorId: string) {
    const today = new Date().toISOString().split('T')[0];

    const active = await this.appointmentRepo.findOne({
      where: { doctor_id: doctorId, date: today, status: AppointmentStatus.ACTIVE },
    });

    if (active) {
      active.status = AppointmentStatus.DONE;
      await this.appointmentRepo.save(active);
    }

    const next = await this.appointmentRepo.findOne({
      where: { doctor_id: doctorId, date: today, status: AppointmentStatus.WAITING },
      order: { queue_position: 'ASC', created_at: 'ASC' },
    });

    if (next) {
      next.status = AppointmentStatus.ACTIVE;
      await this.appointmentRepo.save(next);

      // Look up the new "next-up" patient (still waiting after promotion)
      const upcoming = await this.appointmentRepo.findOne({
        where: { doctor_id: doctorId, date: today, status: AppointmentStatus.WAITING },
        order: { queue_position: 'ASC', created_at: 'ASC' },
      });

      const toNotify = (a: Appointment | null) => {
        if (!a) return null;
        return {
          id: a.id,
          name: a.patient?.name ?? a.patient_name ?? null,
          phone: a.patient_phone ?? null,
          hide_name: a.hide_name,
        };
      };

      return {
        ...next,
        notify: {
          now_serving: toNotify(next),
          next_up: toNotify(upcoming),
        },
      };
    }

    return { message: 'No more patients in queue', notify: { now_serving: null, next_up: null } };
  }

  async remove(id: string) {
    const appt = await this.appointmentRepo.findOne({ where: { id } });
    if (!appt) throw new NotFoundException('Appointment not found');
    await deleteAppointmentActionMessages(this.messageRepo, [id]);
    await this.appointmentRepo.delete(id);
    return { message: 'Appointment deleted' };
  }

  async listForDoctor(doctorId: string) {
    const appts = await this.appointmentRepo.find({
      where: { doctor_id: doctorId },
      order: { date: 'DESC', time: 'DESC', created_at: 'DESC' },
      take: 200,
    });
    return appts;
  }

  /** Hide the meeting link once the appointment window (start + duration) passes. */
  private activeMeetingLink(
    date: string,
    time: string | null,
    durationMinutes: number,
    link: string | null,
  ): string | null {
    if (!link || !time) return link;
    const end =
      new Date(`${date}T${time}`).getTime() +
      (durationMinutes + 5) * 60_000;
    return Date.now() > end ? null : link;
  }

  private mapUpcomingAppointment(a: Appointment, otherName: string, otherUserId: string | null) {
    const durationMinutes = a.doctor?.video_consultation_minutes ?? 30;
    const paymentStatus = a.payment_status ?? 'none';
    return {
      id: a.id,
      date: a.date,
      time: a.time,
      status: a.status,
      duration_minutes: durationMinutes,
      meeting_link: this.activeMeetingLink(
        a.date,
        a.time,
        durationMinutes,
        a.meeting_link,
      ),
      other_name: otherName,
      other_user_id: otherUserId,
      ai_patient_insight: a.ai_patient_insight ?? null,
      booked_via_app: a.booked_via_app,
      payment_status: paymentStatus,
      payment_amount:
        a.payment_amount === null ? null : Number(a.payment_amount),
      payment_currency: a.payment_currency,
      payment_proof_url: a.payment_proof_url,
      payment_link:
        paymentStatus === 'awaiting_payment'
          ? a.doctor?.payment_link?.trim() || null
          : null,
    };
  }

  async listUpcomingForUser(userId: string, role: string) {
    const today = localDateYmd();

    if (role === 'doctor') {
      const doctor = await this.doctorRepo.findOne({ where: { user_id: userId } });
      if (!doctor) return [];
      const appts = await this.appointmentRepo.find({
        where: {
          doctor_id: doctor.id,
          date: MoreThanOrEqual(today),
          status: In([
            AppointmentStatus.PENDING,
            AppointmentStatus.CONFIRMED,
            AppointmentStatus.WAITING,
            AppointmentStatus.ACTIVE,
          ]),
        },
        order: { date: 'ASC', time: 'ASC' },
      });
      return appts.map((a) =>
        this.mapUpcomingAppointment(
          a,
          a.patient?.name ?? a.patient_name ?? 'Patient',
          a.patient_user_id ?? null,
        ),
      );
    }

    const appts = await this.appointmentRepo.find({
      where: {
        patient_user_id: userId,
        date: MoreThanOrEqual(today),
        status: In([
          AppointmentStatus.PENDING,
          AppointmentStatus.CONFIRMED,
          AppointmentStatus.WAITING,
          AppointmentStatus.ACTIVE,
        ]),
      },
      order: { date: 'ASC', time: 'ASC' },
    });
    return appts.map((a) =>
      this.mapUpcomingAppointment(
        a,
        a.doctor?.name ?? 'Doctor',
        a.doctor?.user_id ?? null,
      ),
    );
  }

  /**
   * App-booked video visits for the consultations tab — includes upcoming slots
   * and anything still in the payment gate (even if the date has passed).
   */
  async listVideoConsultationsForUser(userId: string, role: string) {
    const today = localDateYmd();
    const isDoctor = String(role ?? '').toLowerCase() === 'doctor';
    const upcomingStatuses = [
      AppointmentStatus.PENDING,
      AppointmentStatus.CONFIRMED,
      AppointmentStatus.WAITING,
      AppointmentStatus.ACTIVE,
    ];
    const chatIds = await this.chatLinkedAppointmentIds(userId);

    const qb = this.appointmentRepo.createQueryBuilder('a');

    if (isDoctor) {
      const doctor = await this.doctorRepo.findOne({ where: { user_id: userId } });
      if (!doctor) return [];
      qb.andWhere(
        new Brackets((owner) => {
          owner.where('a.doctor_id = :doctorId', { doctorId: doctor.id });
          if (chatIds.length) {
            owner.orWhere('a.id IN (:...chatIds)', { chatIds });
          }
        }),
      );
    } else {
      qb.andWhere(
        new Brackets((owner) => {
          owner.where('a.patient_user_id = :patientUserId', {
            patientUserId: userId,
          });
          if (chatIds.length) {
            owner.orWhere('a.id IN (:...chatIds)', { chatIds });
          }
        }),
      );
    }

    qb.leftJoinAndSelect('a.doctor', 'doctor')
      .leftJoinAndSelect('a.patient', 'patient')
      .andWhere('a.status NOT IN (:...closed)', {
        closed: [AppointmentStatus.CANCELLED, AppointmentStatus.REJECTED],
      })
      .andWhere(
        new Brackets((sub) => {
          sub
            .where('a.payment_status IN (:...paymentPending)', {
              paymentPending: ['awaiting_payment', 'proof_submitted'],
            })
            .orWhere(
              new Brackets((upcoming) => {
                upcoming
                  .where('a.date >= :today', { today })
                  .andWhere('a.status IN (:...upcomingStatuses)', {
                    upcomingStatuses,
                  });
              }),
            );
        }),
      )
      .orderBy('a.date', 'ASC')
      .addOrderBy('a.time', 'ASC');

    const appts = await qb.getMany();

    if (isDoctor) {
      return appts.map((a) =>
        this.mapUpcomingAppointment(
          a,
          a.patient?.name ?? a.patient_name ?? 'Patient',
          a.patient_user_id ?? null,
        ),
      );
    }

    return appts.map((a) =>
      this.mapUpcomingAppointment(
        a,
        a.doctor?.name ?? 'Doctor',
        a.doctor?.user_id ?? null,
      ),
    );
  }

  async findById(id: string) {
    const appt = await this.appointmentRepo.findOne({ where: { id } });
    if (!appt) throw new NotFoundException('Appointment not found');
    let intake_test: IntakeTest | null = null;
    if (appt.intake_test_id) {
      intake_test = await this.intakeRepo.findOne({
        where: { id: appt.intake_test_id },
      });
    }
    return { ...appt, intake_test };
  }
}
