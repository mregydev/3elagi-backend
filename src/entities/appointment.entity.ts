import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Clinic } from './clinic.entity';
import { Doctor } from './doctor.entity';
import { Patient } from './patient.entity';

export enum AppointmentStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  REJECTED = 'rejected',
  WAITING = 'waiting',
  ACTIVE = 'active',
  DONE = 'done',
  CANCELLED = 'cancelled',
}

@Entity('appointments')
export class Appointment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  clinic_id: string;

  @ManyToOne(() => Clinic, { eager: false })
  @JoinColumn({ name: 'clinic_id' })
  clinic: Clinic;

  @Column({ nullable: true })
  doctor_id: string | null;

  @ManyToOne(() => Doctor, { nullable: true, eager: true })
  @JoinColumn({ name: 'doctor_id' })
  doctor: Doctor | null;

  @Column({ nullable: true })
  patient_id: string;

  @ManyToOne(() => Patient, { nullable: true, eager: true })
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Column({ nullable: true })
  patient_name: string;

  @Column()
  patient_phone: string;

  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'time', nullable: true })
  time: string | null;

  @Column({
    type: 'enum',
    enum: AppointmentStatus,
    default: AppointmentStatus.WAITING,
  })
  status: AppointmentStatus;

  @Column({ default: 0 })
  queue_position: number;

  @Column({ type: 'uuid', nullable: true })
  intake_test_id: string | null;

  @Column({ type: 'jsonb', nullable: true })
  intake_answers: Record<string, string[]> | null;

  @Column({ type: 'boolean', default: false })
  booked_via_app: boolean;

  @Column({ type: 'uuid', nullable: true })
  patient_user_id: string | null;

  @Column({ type: 'boolean', default: false })
  hide_name: boolean;

  @Column({ type: 'text', nullable: true })
  meeting_link: string | null;

  /** AI-written, doctor-facing note (why the patient booked + relevant history). */
  @Column({ type: 'text', nullable: true })
  ai_patient_insight: string | null;

  @Column({ type: 'uuid', nullable: true })
  video_call_session_id: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  reminder_sent_at: Date | null;

  /** EGP credits reserved from the patient when booking via app. */
  @Column({ type: 'int', default: 0 })
  reserved_points: number;

  /** True after reserved credits were settled to the doctor. */
  @Column({ type: 'boolean', default: false })
  points_settled: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
