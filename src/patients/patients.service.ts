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

  async findById(id: string) {
    const patient = await this.patientRepo.findOne({ where: { id } });
    if (!patient) throw new NotFoundException('Patient not found');
    return patient;
  }

  async findByIdWithDocuments(id: string, userId: string, role: string) {
    const patient = await this.findById(id);
  //  await this.assertClinicAccess(patient.clinic_id, userId, role);
    const documents = await this.docRepo.find({ where: { patient_id: id } });
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

  async getDoctorPatients(doctorId: string, userId: string) {
    const doctor = await this.doctorRepo.findOne({ where: { id: doctorId } });
    if (!doctor) throw new NotFoundException('Doctor not found');
    if (doctor.user_id !== userId) {
      throw new ForbiddenException('You can only access your own patients');
    }
    const appts = await this.appointmentRepo.find({
      where: { doctor_id: doctorId },
      order: { date: 'DESC', time: 'DESC' },
    });
    const patientIds = Array.from(
      new Set(appts.map((a) => a.patient_id).filter((x): x is string => !!x)),
    );
    const patients = patientIds.length
      ? await this.patientRepo.find({ where: { id: In(patientIds) } })
      : [];
    const pMap = new Map(patients.map((p) => [p.id, p]));
    const today = new Date().toISOString().split('T')[0];

    const grouped = new Map<
      string,
      {
        patient_id: string;
        name: string;
        phone: string;
        last_appointment_id: string;
        last_date: string;
        last_intake_test_id: string | null;
        future_count: number;
        past_count: number;
      }
    >();
    for (const a of appts) {
      if (!a.patient_id) continue;
      const p = pMap.get(a.patient_id);
      if (!p) continue;
      let entry = grouped.get(a.patient_id);
      if (!entry) {
        entry = {
          patient_id: a.patient_id,
          name: p.name,
          phone: p.phone,
          last_appointment_id: a.id,
          last_date: a.date,
          last_intake_test_id: a.intake_test_id ?? null,
          future_count: 0,
          past_count: 0,
        };
        grouped.set(a.patient_id, entry);
      }
      // appointments are sorted DESC, so first one is the latest
      if (a.intake_test_id && !entry.last_intake_test_id) {
        entry.last_intake_test_id = a.intake_test_id;
        entry.last_appointment_id = a.id;
      }
      if (a.date >= today) entry.future_count++;
      else entry.past_count++;
    }
    return Array.from(grouped.values());
  }
}
