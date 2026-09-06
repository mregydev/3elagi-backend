import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, LessThanOrEqual, Not, Repository } from 'typeorm';
import {
  IntakeExamAssignment,
  IntakeExamRecurrence,
} from '../entities/intake-exam-assignment.entity';
import {
  IntakeExamInstance,
  IntakeExamInstanceStatus,
} from '../entities/intake-exam-instance.entity';
import { IntakeTest, IntakeQuestion } from '../entities/intake-test.entity';
import { Doctor } from '../entities/doctor.entity';
import { Diagnosis } from '../entities/diagnosis.entity';
import { DoctorPatientAccessService } from '../doctor-patient-access/doctor-patient-access.service';
import { PresenceGateway } from '../presence/presence.gateway';
import { PushNotificationsService } from '../push-notifications/push-notifications.service';
import { AssignIntakeExamDto } from './dto/assign-intake-exam.dto';
import { SaveIntakeExamAnswersDto } from './dto/save-intake-exam-answers.dto';

const CAIRO_TIME_ZONE = 'Africa/Cairo';
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function cairoNow(date = new Date()) {
  return new Date(
    date.toLocaleString('en-US', { timeZone: CAIRO_TIME_ZONE }),
  );
}

function addRecurrence(
  from: Date,
  recurrence: IntakeExamRecurrence,
  interval: number,
): Date {
  const next = new Date(from);
  const n = Math.max(1, interval || 1);
  switch (recurrence) {
    case 'daily':
      next.setDate(next.getDate() + n);
      break;
    case 'weekly':
      next.setDate(next.getDate() + 7 * n);
      break;
    case 'monthly':
      next.setMonth(next.getMonth() + n);
      break;
    case 'yearly':
      next.setFullYear(next.getFullYear() + n);
      break;
    default:
      return next;
  }
  return next;
}

export type LinkedDiagnosisSummary = { id: string; desc: string };

export interface IntakeExamInstanceView {
  id: string;
  assignment_id: string;
  patient_user_id: string;
  doctor_id: string;
  doctor_name: string | null;
  intake_test_id: string;
  exam_name: string;
  instance_number: number;
  deadline_at: string;
  questions: IntakeQuestion[];
  answers: Record<string, string[]>;
  status: IntakeExamInstanceStatus;
  completed_at: string | null;
  recurrence_type: IntakeExamRecurrence;
  recurrence_interval: number;
  created_at: string;
  diagnosis_id: string | null;
  linked_diagnoses: LinkedDiagnosisSummary[];
}

// TODO: Add a new field to the intake exam instance to store the payment status
@Injectable()
export class IntakeExamsService {
  private readonly logger = new Logger(IntakeExamsService.name);

  constructor(
    @InjectRepository(IntakeExamAssignment)
    private assignmentRepo: Repository<IntakeExamAssignment>,
    @InjectRepository(IntakeExamInstance)
    private instanceRepo: Repository<IntakeExamInstance>,
    @InjectRepository(IntakeTest)
    private testRepo: Repository<IntakeTest>,
    @InjectRepository(Doctor)
    private doctorRepo: Repository<Doctor>,
    @InjectRepository(Diagnosis)
    private diagnosisRepo: Repository<Diagnosis>,
    private accessService: DoctorPatientAccessService,
    private presenceGateway: PresenceGateway,
    private pushNotifications: PushNotificationsService,
  ) {}

  private async getDoctor(userId: string): Promise<Doctor> {
    const doctor = await this.doctorRepo.findOne({ where: { user_id: userId } });
    if (!doctor) throw new ForbiddenException('Doctor profile not found');
    return doctor;
  }

  private parseDeadline(raw: string): Date {
    if (!raw?.trim()) {
      throw new BadRequestException('deadline_at is required');
    }
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException('deadline_at must be a valid ISO datetime');
    }
    return parsed;
  }

  private validateRecurrence(
    type: IntakeExamRecurrence | undefined,
    interval: number | undefined,
  ): { recurrence_type: IntakeExamRecurrence; recurrence_interval: number } {
    const allowed: IntakeExamRecurrence[] = [
      'none',
      'daily',
      'weekly',
      'monthly',
      'yearly',
    ];
    const recurrence_type = allowed.includes(type as IntakeExamRecurrence)
      ? (type as IntakeExamRecurrence)
      : 'none';
    const recurrence_interval =
      recurrence_type === 'none'
        ? 1
        : Math.max(1, Math.floor(Number(interval) || 1));
    return { recurrence_type, recurrence_interval };
  }

  private toView(
    instance: IntakeExamInstance,
    assignment: IntakeExamAssignment,
    doctorName: string | null,
  ): IntakeExamInstanceView {
    return {
      id: instance.id,
      assignment_id: instance.assignment_id,
      patient_user_id: instance.patient_user_id,
      doctor_id: instance.doctor_id,
      doctor_name: doctorName,
      intake_test_id: instance.intake_test_id,
      exam_name: instance.exam_name,
      instance_number: instance.instance_number,
      deadline_at: instance.deadline_at.toISOString(),
      questions: instance.questions ?? [],
      answers: instance.answers ?? {},
      status: instance.status,
      completed_at: instance.completed_at?.toISOString() ?? null,
      recurrence_type: assignment.recurrence_type,
      recurrence_interval: assignment.recurrence_interval,
      created_at: instance.created_at.toISOString(),
      diagnosis_id: assignment.diagnosis_id ?? null,
      linked_diagnoses: [],
    };
  }

  private async enrichViewsWithLinkedDiagnoses(
    views: IntakeExamInstanceView[],
  ): Promise<IntakeExamInstanceView[]> {
    const diagnosisIds = [
      ...new Set(
        views.map((view) => view.diagnosis_id).filter((id): id is string => !!id),
      ),
    ];
    if (!diagnosisIds.length) return views;

    const diagnoses = await this.diagnosisRepo.find({
      where: { id: In(diagnosisIds) },
    });
    const byId = new Map(
      diagnoses.map((row) => [row.id, { id: row.id, desc: row.desc }]),
    );

    return views.map((view) => ({
      ...view,
      linked_diagnoses:
        view.diagnosis_id && byId.has(view.diagnosis_id)
          ? [byId.get(view.diagnosis_id)!]
          : [],
    }));
  }

  private async toViewEnriched(
    instance: IntakeExamInstance,
    assignment: IntakeExamAssignment,
    doctorName: string | null,
  ): Promise<IntakeExamInstanceView> {
    const [view] = await this.enrichViewsWithLinkedDiagnoses([
      this.toView(instance, assignment, doctorName),
    ]);
    return view;
  }

  private async doctorNameFor(doctorId: string): Promise<string | null> {
    const doctor = await this.doctorRepo.findOne({ where: { id: doctorId } });
    return doctor?.name ?? null;
  }

  private validateAnswersAgainstQuestions(
    questions: IntakeQuestion[],
    answers: Record<string, string[]>,
    requireAll: boolean,
  ): Record<string, string[]> {
    const cleaned: Record<string, string[]> = {};
    for (const q of questions) {
      if (q.type === 'guidance') continue;
      const raw = answers[q.id];
      const values = Array.isArray(raw)
        ? raw.map((v) => String(v).trim()).filter(Boolean)
        : [];
      if (requireAll && q.required && values.length === 0) {
        throw new BadRequestException(`Question "${q.text}" is required`);
      }
      if (values.length) cleaned[q.id] = values;
    }
    return cleaned;
  }

  private async createInstanceForAssignment(
    assignment: IntakeExamAssignment,
    test: IntakeTest,
    deadlineAt: Date,
    instanceNumber: number,
  ): Promise<IntakeExamInstance> {
    const instance = this.instanceRepo.create({
      assignment_id: assignment.id,
      patient_user_id: assignment.patient_user_id,
      doctor_id: assignment.doctor_id,
      intake_test_id: assignment.intake_test_id,
      exam_name: assignment.exam_name,
      instance_number: instanceNumber,
      deadline_at: deadlineAt,
      questions: test.questions ?? [],
      answers: {},
      status: 'pending',
      reminder_sent_at: null,
      completed_at: null,
    });
    return this.instanceRepo.save(instance);
  }

  async assignExam(
    doctorUserId: string,
    dto: AssignIntakeExamDto,
  ): Promise<IntakeExamInstanceView> {
    const doctor = await this.getDoctor(doctorUserId);
    await this.accessService.assertDoctorCanPrescribeForPatient(
      doctorUserId,
      dto.patient_user_id,
    );

    const test = await this.testRepo.findOne({ where: { id: dto.intake_test_id } });
    if (!test) throw new NotFoundException('Intake test not found');
    if (test.doctor_id && test.doctor_id !== doctor.id) {
      throw new ForbiddenException('Not your intake test');
    }

    const deadlineAt = this.parseDeadline(dto.deadline_at);
    const { recurrence_type, recurrence_interval } = this.validateRecurrence(
      dto.recurrence_type,
      dto.recurrence_interval,
    );

    const assignment = await this.assignmentRepo.save(
      this.assignmentRepo.create({
        patient_user_id: dto.patient_user_id,
        doctor_id: doctor.id,
        intake_test_id: test.id,
        exam_name: test.name,
        exam_description: test.description,
        recurrence_type,
        recurrence_interval,
        first_deadline_at: deadlineAt,
        is_active: true,
      }),
    );

    const instance = await this.createInstanceForAssignment(
      assignment,
      test,
      deadlineAt,
      1,
    );

    const doctorName = doctor.name ?? null;
    return this.toViewEnriched(instance, assignment, doctorName);
  }

  async listForPatientUser(
    patientUserId: string,
    viewerUserId: string,
    viewerRole: string,
  ): Promise<IntakeExamInstanceView[]> {
    if (viewerRole === 'doctor') {
      const doctor = await this.getDoctor(viewerUserId);
      await this.accessService.assertDoctorCanPrescribeForPatient(
        viewerUserId,
        patientUserId,
      );
      // Assigning doctor can see all of their instances (pending / in progress / completed).
      const instances = await this.instanceRepo.find({
        where: {
          patient_user_id: patientUserId,
          doctor_id: doctor.id,
        },
        order: { deadline_at: 'DESC' },
      });
      return this.mapInstances(instances);
    }

    if (viewerUserId !== patientUserId) {
      throw new ForbiddenException('You can only access your own intake exams');
    }
    await this.accessService.assertPatientUser(patientUserId);

    const instances = await this.instanceRepo.find({
      where: { patient_user_id: patientUserId },
      order: { deadline_at: 'DESC' },
    });
    return this.mapInstances(instances);
  }

  private async mapInstances(
    instances: IntakeExamInstance[],
  ): Promise<IntakeExamInstanceView[]> {
    if (!instances.length) return [];
    const assignmentIds = Array.from(
      new Set(instances.map((i) => i.assignment_id)),
    );
    const assignments = await this.assignmentRepo.find({
      where: { id: In(assignmentIds) },
    });
    const assignmentMap = new Map(assignments.map((a) => [a.id, a]));
    const doctorIds = Array.from(new Set(instances.map((i) => i.doctor_id)));
    const doctors = await this.doctorRepo.find({
      where: { id: In(doctorIds) },
    });
    const doctorMap = new Map(doctors.map((d) => [d.id, d.name ?? null]));

    return this.enrichViewsWithLinkedDiagnoses(
      instances.map((instance) => {
        const assignment = assignmentMap.get(instance.assignment_id);
        if (!assignment) {
          throw new NotFoundException('Assignment not found for instance');
        }
        return this.toView(
          instance,
          assignment,
          doctorMap.get(instance.doctor_id) ?? null,
        );
      }),
    );
  }

  async getInstance(
    id: string,
    viewerUserId: string,
    viewerRole: string,
  ): Promise<IntakeExamInstanceView> {
    const instance = await this.instanceRepo.findOne({ where: { id } });
    if (!instance) throw new NotFoundException('Intake exam instance not found');
    const assignment = await this.assignmentRepo.findOne({
      where: { id: instance.assignment_id },
    });
    if (!assignment) throw new NotFoundException('Assignment not found');

    if (viewerRole === 'doctor') {
      const doctor = await this.getDoctor(viewerUserId);
      if (instance.doctor_id !== doctor.id) {
        throw new ForbiddenException('Not your patient intake exam');
      }
      await this.accessService.assertDoctorCanPrescribeForPatient(
        viewerUserId,
        instance.patient_user_id,
      );
      // Allow opening shared/pending exams the doctor assigned (not only completed).
    } else if (viewerUserId !== instance.patient_user_id) {
      throw new ForbiddenException('You can only access your own intake exams');
    }

    const doctorName = await this.doctorNameFor(instance.doctor_id);
    return this.toViewEnriched(instance, assignment, doctorName);
  }

  async saveAnswers(
    id: string,
    patientUserId: string,
    dto: SaveIntakeExamAnswersDto,
  ): Promise<IntakeExamInstanceView> {
    const instance = await this.instanceRepo.findOne({ where: { id } });
    if (!instance) throw new NotFoundException('Intake exam instance not found');
    if (instance.patient_user_id !== patientUserId) {
      throw new ForbiddenException('Not your intake exam');
    }

    const assignment = await this.assignmentRepo.findOne({
      where: { id: instance.assignment_id },
    });
    if (!assignment) throw new NotFoundException('Assignment not found');

    const requireAll = dto.complete === true;
    const cleaned = this.validateAnswersAgainstQuestions(
      instance.questions ?? [],
      dto.answers ?? {},
      requireAll,
    );

    instance.answers = cleaned;
    if (requireAll) {
      instance.status = 'completed';
      instance.completed_at = new Date();
    } else {
      // Draft / partial save: update THIS instance only — never spawn another.
      instance.status = Object.keys(cleaned).length ? 'in_progress' : 'pending';
      instance.completed_at = null;
    }

    const saved = await this.instanceRepo.save(instance);

    if (requireAll) {
      if (assignment.recurrence_type === 'none') {
        // One-shot assignment: close it so nothing creates another instance later.
        if (assignment.is_active) {
          assignment.is_active = false;
          await this.assignmentRepo.save(assignment);
        }
      } else if (assignment.is_active) {
        await this.ensureNextInstance(assignment);
      }
    }

    const doctorName = await this.doctorNameFor(saved.doctor_id);
    return this.toViewEnriched(saved, assignment, doctorName);
  }

  async resetAnswers(
    id: string,
    patientUserId: string,
  ): Promise<IntakeExamInstanceView> {
    const instance = await this.instanceRepo.findOne({ where: { id } });
    if (!instance) throw new NotFoundException('Intake exam instance not found');
    if (instance.patient_user_id !== patientUserId) {
      throw new ForbiddenException('Not your intake exam');
    }

    const assignment = await this.assignmentRepo.findOne({
      where: { id: instance.assignment_id },
    });
    if (!assignment) throw new NotFoundException('Assignment not found');

    instance.answers = {};
    instance.status = 'pending';
    instance.completed_at = null;
    const saved = await this.instanceRepo.save(instance);
    const doctorName = await this.doctorNameFor(saved.doctor_id);
    return this.toViewEnriched(saved, assignment, doctorName);
  }

  async deleteInstance(
    id: string,
    userId: string,
    role: string,
  ): Promise<{ ok: true }> {
    const instance = await this.instanceRepo.findOne({ where: { id } });
    if (!instance) throw new NotFoundException('Intake exam instance not found');

    if (role === 'doctor') {
      const doctor = await this.getDoctor(userId);
      if (instance.doctor_id !== doctor.id) {
        throw new ForbiddenException('Not your patient intake exam');
      }
    } else if (userId !== instance.patient_user_id) {
      throw new ForbiddenException('You can only delete your own intake exams');
    }

    await this.instanceRepo.delete(id);

    const remaining = await this.instanceRepo.count({
      where: { assignment_id: instance.assignment_id },
    });
    if (remaining === 0) {
      await this.assignmentRepo.delete(instance.assignment_id);
    }

    return { ok: true };
  }

  private async ensureNextInstance(
    assignment: IntakeExamAssignment,
  ): Promise<IntakeExamInstance | null> {
    if (!assignment.is_active || assignment.recurrence_type === 'none') {
      return null;
    }

    // Never create a follow-up while any open instance still exists.
    const open = await this.instanceRepo.findOne({
      where: {
        assignment_id: assignment.id,
        status: Not('completed'),
      },
    });
    if (open) return null;

    const lastCompleted = await this.instanceRepo.findOne({
      where: {
        assignment_id: assignment.id,
        status: 'completed',
      },
      order: { instance_number: 'DESC' },
    });
    if (!lastCompleted) return null;

    const test = await this.testRepo.findOne({
      where: { id: assignment.intake_test_id },
    });
    if (!test) return null;

    const nextDeadline = addRecurrence(
      lastCompleted.deadline_at,
      assignment.recurrence_type,
      assignment.recurrence_interval,
    );

    return this.createInstanceForAssignment(
      assignment,
      test,
      nextDeadline,
      lastCompleted.instance_number + 1,
    );
  }

  async sendDueReminders(): Promise<{
    checkedInstances: number;
    remindedInstances: number;
    notifiedPatients: number;
  }> {
    const now = cairoNow();
    const inOneDay = new Date(now.getTime() + ONE_DAY_MS);

    const candidates = await this.instanceRepo.find({
      where: {
        status: Not('completed'),
        reminder_sent_at: IsNull(),
        deadline_at: LessThanOrEqual(inOneDay),
      },
    });

    const due = candidates.filter((instance) => {
      const deadlineCairo = cairoNow(instance.deadline_at);
      return deadlineCairo.getTime() >= now.getTime();
    });

    let remindedInstances = 0;
    let notifiedPatients = 0;

    for (const instance of due) {
      const claim = await this.instanceRepo.update(
        { id: instance.id, reminder_sent_at: IsNull() },
        { reminder_sent_at: new Date() },
      );
      if (!claim.affected) continue;

      remindedInstances += 1;
      const doctorName = (await this.doctorNameFor(instance.doctor_id)) ?? 'Doctor';
      const deadlineLabel = instance.deadline_at.toLocaleString('en-GB', {
        timeZone: CAIRO_TIME_ZONE,
        dateStyle: 'medium',
        timeStyle: 'short',
      });

      const title = 'Intake exam reminder';
      const body = `Your intake exam "${instance.exam_name}" from Dr. ${doctorName} is due by ${deadlineLabel}. Open your medical records to complete it.`;

      this.presenceGateway.emitToUser(instance.patient_user_id, 'intake-exam:reminder', {
        instanceId: instance.id,
        examName: instance.exam_name,
        doctorName,
        deadlineAt: instance.deadline_at.toISOString(),
        title,
        body,
      });

      try {
        await this.pushNotifications.sendIntakeExamReminder({
          recipientId: instance.patient_user_id,
          instanceId: instance.id,
          examName: instance.exam_name,
          doctorName,
          deadlineAt: instance.deadline_at.toISOString(),
        });
        notifiedPatients += 1;
      } catch (err) {
        this.logger.warn(
          `Intake exam push failed for ${instance.id}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }

    return {
      checkedInstances: candidates.length,
      remindedInstances,
      notifiedPatients,
    };
  }
}
