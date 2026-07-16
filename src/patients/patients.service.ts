import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Patient } from '../entities/patient.entity';
import { MedicalDocument } from '../entities/medical-document.entity';
import { Clinic } from '../entities/clinic.entity';
import { Doctor } from '../entities/doctor.entity';
import { Appointment } from '../entities/appointment.entity';
import { IntakeTest } from '../entities/intake-test.entity';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { PatientProfile } from '../entities/patient-profile.entity';
import { User, UserRole } from '../entities/user.entity';
import { In } from 'typeorm';

@Injectable()
export class PatientsService {
  constructor(
    @InjectRepository(Patient) private patientRepo: Repository<Patient>,
    @InjectRepository(MedicalDocument) private docRepo: Repository<MedicalDocument>,
    @InjectRepository(Clinic) private clinicRepo: Repository<Clinic>,
    @InjectRepository(Doctor) private doctorRepo: Repository<Doctor>,
    @InjectRepository(Appointment) private appointmentRepo: Repository<Appointment>,
    @InjectRepository(IntakeTest) private intakeRepo: Repository<IntakeTest>,
    @InjectRepository(PatientProfile)
    private patientProfileRepo: Repository<PatientProfile>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
  ) {}

  private async assertClinicAccess(clinicId: string, userId: string, role: string): Promise<void> {
    if (role === 'doctor') {
      const doctor = await this.doctorRepo.findOne({ where: { user_id: userId } });
      if (!doctor || doctor.default_clinic_id !== clinicId) {
        throw new ForbiddenException('You do not have access to this clinic');
      }
    }
  }

  async findByPhone(
    phone: string,
    clinicId: string,
    userId: string,
    role: string,
  ) {
    //await this.assertClinicAccess(clinicId, userId, role);
    return this.patientRepo.findOne({ where: { phone, clinic_id: clinicId } });
  }

  /** `id` is users.id (registered patient user). */
  async findById(id: string) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user || user.role !== UserRole.PATIENT) {
      throw new NotFoundException('Patient not found');
    }
    const profile = await this.patientProfileRepo.findOne({ where: { user_id: id } });
    if (!profile) throw new NotFoundException('Patient profile not found');

    const { password_hash: _, ...safeUser } = user;
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      name: profile.name,
      phone: profile.phone,
      country: profile.country ?? 'EG',
      birth_date: profile.birth_date,
      photo_url: profile.photo_url ?? user.photo_url,
      gender: profile.gender,
      chronic_conditions: profile.chronic_conditions,
      allergies: profile.allergies,
      medical_notes: profile.medical_notes,
      onboarded_at: profile.onboarded_at,
      intake_test_id: profile.intake_test_id,
      intake_answers: profile.intake_answers,
      created_at: profile.created_at,
      updated_at: profile.updated_at,
      user: safeUser,
      profile,
    };
  }

  async findByIdWithDocuments(id: string, userId: string, role: string) {
    const patient = await this.findById(id);
    const documents = await this.docRepo.find({
      where: { patient_id: id },
      order: { created_at: 'DESC' },
    });
    return { ...patient, documents };
  }

  async create(dto: CreatePatientDto) {
    const clinic = await this.clinicRepo.findOne({ where: { id: dto.clinic_id } });
    if (!clinic) throw new NotFoundException('Clinic not found');
    const patient = this.patientRepo.create(dto);
    return this.patientRepo.save(patient);
  }

  async update(id: string, updates: UpdatePatientDto) {
    await this.findById(id);
    await this.patientRepo.update(id, updates);
    return this.findById(id);
  }

  /** Update logged-in patient profile and sync photo to clinic patient rows (same phone). */
  async updateSelf(userId: string, updates: UpdatePatientDto) {
    const profile = await this.patientProfileRepo.findOne({ where: { user_id: userId } });
    if (!profile) throw new NotFoundException('Patient profile not found');

    if (updates.name !== undefined) profile.name = updates.name;
    if (updates.phone !== undefined) profile.phone = updates.phone;
    if (updates.country !== undefined) {
      profile.country = updates.country.trim().toUpperCase();
    }
    if (updates.birth_date !== undefined) profile.birth_date = updates.birth_date;
    if (updates.photo_url !== undefined) profile.photo_url = updates.photo_url;

    await this.patientProfileRepo.save(profile);

    if (updates.photo_url !== undefined) {
      await this.patientRepo.update(
        { phone: profile.phone },
        { photo_url: updates.photo_url },
      );
    }

    return profile;
  }

  async findByClinic(clinicId: string) {
    return this.patientRepo.find({ where: { clinic_id: clinicId } });
  }

  findAll() {
    return this.patientRepo.find({ order: { name: 'ASC' } });
  }

  async getIntakeHistory(patientId: string, userId: string, role: string) {
    const patient = await this.findById(patientId);
    //await this.assertClinicAccess(patient.clinic_id, userId, role);
    const appts = await this.appointmentRepo.find({
      where: { patient_id: patientId },
      order: { date: 'DESC', time: 'DESC' },
    });
    const withIntake = appts.filter(
      (a) => a.intake_test_id && a.intake_answers,
    );
    if (!withIntake.length) return [];
    const testIds = Array.from(
      new Set(
        withIntake.map((a) => a.intake_test_id).filter((x): x is string => !!x),
      ),
    );
    const doctorIds = Array.from(
      new Set(
        withIntake.map((a) => a.doctor_id).filter((x): x is string => !!x),
      ),
    );
    const [tests, doctors] = await Promise.all([
      testIds.length
        ? this.intakeRepo.find({ where: { id: In(testIds) } })
        : Promise.resolve([]),
      doctorIds.length
        ? this.doctorRepo.find({ where: { id: In(doctorIds) } })
        : Promise.resolve([]),
    ]);
    const tMap = new Map(tests.map((t) => [t.id, t]));
    const dMap = new Map(doctors.map((d) => [d.id, d]));
    return withIntake.map((a) => {
      const t = a.intake_test_id ? tMap.get(a.intake_test_id) : null;
      const d = a.doctor_id ? dMap.get(a.doctor_id) : null;
      return {
        appointment_id: a.id,
        date: a.date,
        time: a.time,
        doctor: d
          ? { id: d.id, name: d.name, photo_url: d.photo_url }
          : null,
        intake_test: t
          ? {
              id: t.id,
              name: t.name,
              description: t.description,
              questions: t.questions,
            }
          : null,
        intake_answers: a.intake_answers,
      };
    });
  }

  /** Every row in `users` where role is patient — no appointment/clinic filter. */
  private async listAllPatientUsers() {
    const patientUsers = await this.userRepo.find({
      where: { role: UserRole.PATIENT },
      order: { created_at: 'DESC' },
    });

    const profiles =
      patientUsers.length > 0
        ? await this.patientProfileRepo.find({
            where: { user_id: In(patientUsers.map((u) => u.id)) },
          })
        : [];
    const profileByUserId = new Map(profiles.map((p) => [p.user_id, p]));

    return patientUsers.map((user) => {
      const profile = profileByUserId.get(user.id);
      return {
        user_id: user.id,
        email: user.email,
        name: profile?.name ?? user.email.split('@')[0],
        phone: profile?.phone ?? '',
        photo_url: profile?.photo_url ?? user.photo_url ?? null,
        last_date: null as string | null,
        future_count: 0,
        past_count: 0,
      };
    });
  }

  private enrichWithDoctorAppointmentStats(
    patients: Awaited<ReturnType<PatientsService['listAllPatientUsers']>>,
    doctorId: string,
  ) {
    return this.appointmentRepo
      .find({
        where: { doctor_id: doctorId },
        order: { date: 'DESC', time: 'DESC' },
      })
      .then((appts) => {
        const today = new Date().toISOString().split('T')[0];
        const apptStats = new Map<
          string,
          { last_date: string; future_count: number; past_count: number }
        >();
        for (const a of appts) {
          const pid = a.patient_user_id;
          if (!pid) continue;
          let stats = apptStats.get(pid);
          if (!stats) {
            stats = { last_date: a.date, future_count: 0, past_count: 0 };
            apptStats.set(pid, stats);
          }
          if (a.date >= today) stats.future_count++;
          else stats.past_count++;
        }
        return patients.map((p) => {
          const stats = apptStats.get(p.user_id);
          return {
            ...p,
            last_date: stats?.last_date ?? null,
            future_count: stats?.future_count ?? 0,
            past_count: stats?.past_count ?? 0,
          };
        });
      });
  }

  async getRegisteredPatientsForDoctorUser(userId: string) {
    const doctor = await this.doctorRepo.findOne({ where: { user_id: userId } });
    if (!doctor) throw new NotFoundException('Doctor not found');
    const patients = await this.listAllPatientUsers();
    return this.enrichWithDoctorAppointmentStats(patients, doctor.id);
  }

  async getDoctorPatients(doctorId: string, userId: string) {
    const doctor = await this.doctorRepo.findOne({ where: { id: doctorId } });
    if (!doctor) throw new NotFoundException('Doctor not found');
    if (doctor.user_id !== userId) {
      throw new ForbiddenException('You can only access your own patients');
    }
    const patients = await this.listAllPatientUsers();
    return this.enrichWithDoctorAppointmentStats(patients, doctorId);
  }
}
