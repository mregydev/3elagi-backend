import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Diagnosis } from '../../../entities/diagnosis.entity';
import { DoctorPatientAccess } from '../../../entities/doctor-patient-access.entity';
import { Doctor } from '../../../entities/doctor.entity';
import { PatientProfile } from '../../../entities/patient-profile.entity';
import { Symptom } from '../../../entities/symptom.entity';
import { UserRole } from '../../../entities/user.entity';
import { buildDiagnosisText } from '../../knowledge-text.builder';
import type { AIContextSource } from '../ai-context-source.interface';
import type { AiContextUser, AiIntent } from '../ai-context.types';

interface PatientSummary {
  userId: string;
  name: string;
  recordsAllowed: boolean;
}

interface PatientJourney {
  userId: string;
  name: string;
  diagnoses: Array<{ diagnosis: Diagnosis; symptoms: Symptom[] }>;
}

interface DoctorPatientsPayload {
  patients: PatientSummary[];
  myDiagnoses: Array<{ diagnosis: Diagnosis; symptoms: Symptom[] }>;
  /** Full history for patients who granted records access (all doctors). */
  journeys: PatientJourney[];
}

@Injectable()
export class DoctorPatientsContextSource implements AIContextSource {
  readonly name = 'doctor_patients';

  constructor(
    @InjectRepository(Doctor)
    private readonly doctorRepo: Repository<Doctor>,
    @InjectRepository(DoctorPatientAccess)
    private readonly accessRepo: Repository<DoctorPatientAccess>,
    @InjectRepository(PatientProfile)
    private readonly profileRepo: Repository<PatientProfile>,
    @InjectRepository(Diagnosis)
    private readonly diagnosisRepo: Repository<Diagnosis>,
    @InjectRepository(Symptom)
    private readonly symptomRepo: Repository<Symptom>,
  ) {}

  canHandle(_question: string, intent: AiIntent): boolean {
    return (
      intent === 'doctor_practice_question' ||
      intent === 'medical_record_question' ||
      intent === 'mixed_question'
    );
  }

  async fetchContext(user: AiContextUser): Promise<DoctorPatientsPayload | null> {
    if (user.role !== UserRole.DOCTOR) return null;

    const doctor = await this.doctorRepo.findOne({ where: { user_id: user.id } });
    if (!doctor) return null;

    const accessRows = await this.accessRepo.find({
      where: {
        doctor_id: doctor.id,
        blocked_by_patient: false,
        blocked_by_doctor: false,
      },
      order: { updated_at: 'DESC' },
    });

    const patientUserIds = accessRows.map((r) => r.patient_user_id);
    const profiles = patientUserIds.length
      ? await this.profileRepo.find({ where: { user_id: In(patientUserIds) } })
      : [];
    const profileByUserId = new Map(profiles.map((p) => [p.user_id, p]));

    const patients: PatientSummary[] = accessRows.map((row) => {
      const profile = profileByUserId.get(row.patient_user_id);
      return {
        userId: row.patient_user_id,
        name: profile?.name ?? 'Unknown patient',
        recordsAllowed: row.records_allowed,
      };
    });

    const myDiagnoses = await this.diagnosisRepo.find({
      where: { doctor_id: doctor.id },
      order: { created_at: 'DESC' },
      take: 20,
    });

    const withSymptoms = await Promise.all(
      myDiagnoses.map(async (diagnosis) => ({
        diagnosis,
        symptoms: await this.symptomRepo.find({
          where: { diagnosis_id: diagnosis.id },
        }),
      })),
    );

    // Full journey (all diagnoses, any doctor) for records-allowed patients.
    const journeyIds = patients
      .filter((p) => p.recordsAllowed)
      .map((p) => p.userId);
    let journeys: PatientJourney[] = [];
    if (journeyIds.length) {
      const patientDiagnoses = await this.diagnosisRepo.find({
        where: { patient_id: In(journeyIds) },
        order: { created_at: 'DESC' },
        take: 80,
      });
      const diagIds = patientDiagnoses.map((d) => d.id);
      const allSymptoms = diagIds.length
        ? await this.symptomRepo.find({ where: { diagnosis_id: In(diagIds) } })
        : [];
      const symptomsByDiag = new Map<string, Symptom[]>();
      for (const s of allSymptoms) {
        const arr = symptomsByDiag.get(s.diagnosis_id) ?? [];
        arr.push(s);
        symptomsByDiag.set(s.diagnosis_id, arr);
      }
      const byPatient = new Map<
        string,
        Array<{ diagnosis: Diagnosis; symptoms: Symptom[] }>
      >();
      for (const d of patientDiagnoses) {
        const arr = byPatient.get(d.patient_id) ?? [];
        arr.push({ diagnosis: d, symptoms: symptomsByDiag.get(d.id) ?? [] });
        byPatient.set(d.patient_id, arr);
      }
      journeys = journeyIds
        .filter((id) => byPatient.has(id))
        .map((id) => ({
          userId: id,
          name: patients.find((p) => p.userId === id)?.name ?? 'Patient',
          diagnoses: byPatient.get(id) ?? [],
        }));
    }

    return { patients, myDiagnoses: withSymptoms, journeys };
  }

  buildContextText(data: unknown): string {
    const payload = data as DoctorPatientsPayload | null;
    if (!payload) return '';

    const sections: string[] = [];

    if (payload.patients.length) {
      sections.push('[Patients you have dealt with]');
      for (const p of payload.patients) {
        const access = p.recordsAllowed
          ? 'medical records access granted'
          : 'no medical records access';
        sections.push(`- ${p.name} (${access})`);
      }
    } else {
      sections.push('[Patients you have dealt with]\nNo patients on record yet.');
    }

    if (payload.myDiagnoses.length) {
      sections.push('\n[Diagnoses you added]');
      for (const row of payload.myDiagnoses) {
        const patientName =
          payload.patients.find((p) => p.userId === row.diagnosis.patient_id)
            ?.name ?? 'Patient';
        sections.push(
          `Patient: ${patientName}\n${buildDiagnosisText(row.diagnosis, row.symptoms)}`,
        );
      }
    } else {
      sections.push('\n[Diagnoses you added]\nNo diagnoses recorded by you yet.');
    }

    if (payload.journeys.length) {
      sections.push(
        "\n[Patient medical journeys — the FULL diagnosis history (from any doctor) for patients who granted you records access. When the doctor asks about a patient, use this to summarize that patient's journey in a clinically useful way: the recurring diagnoses/diseases, repeated symptoms, and how their condition has evolved over time — so the doctor can prepare and follow up.]",
      );
      for (const j of payload.journeys) {
        sections.push(`Patient: ${j.name}`);
        for (const row of j.diagnoses) {
          sections.push(buildDiagnosisText(row.diagnosis, row.symptoms));
        }
        sections.push('---');
      }
    }

    return sections.join('\n\n');
  }

  async getVersionKey(user: AiContextUser): Promise<string> {
    if (user.role !== UserRole.DOCTOR) return 'doctor_patients:skip';
    const doctor = await this.doctorRepo.findOne({ where: { user_id: user.id } });
    if (!doctor) return 'doctor_patients:none';

    const [accessCount, diagCount] = await Promise.all([
      this.accessRepo.count({ where: { doctor_id: doctor.id } }),
      this.diagnosisRepo.count({ where: { doctor_id: doctor.id } }),
    ]);

    // Journey data changes when other doctors touch a records-allowed patient too.
    const allowed = await this.accessRepo.find({
      where: {
        doctor_id: doctor.id,
        records_allowed: true,
        blocked_by_patient: false,
        blocked_by_doctor: false,
      },
      select: ['patient_user_id'],
    });
    const journeyIds = allowed.map((a) => a.patient_user_id);
    const journeyDiagCount = journeyIds.length
      ? await this.diagnosisRepo.count({ where: { patient_id: In(journeyIds) } })
      : 0;

    return `doctor_patients:${doctor.id}:${accessCount}:${diagCount}:${journeyDiagCount}`;
  }
}
