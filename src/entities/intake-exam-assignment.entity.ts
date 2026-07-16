import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Doctor } from './doctor.entity';
import { IntakeTest } from './intake-test.entity';

export type IntakeExamRecurrence =
  | 'none'
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'yearly';

@Entity('intake_exam_assignments')
export class IntakeExamAssignment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  patient_user_id: string;

  @Column({ type: 'uuid' })
  doctor_id: string;

  @ManyToOne(() => Doctor, { eager: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'doctor_id' })
  doctor: Doctor;

  @Column({ type: 'uuid' })
  intake_test_id: string;

  @ManyToOne(() => IntakeTest, { eager: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'intake_test_id' })
  intake_test: IntakeTest;

  @Column()
  exam_name: string;

  @Column({ nullable: true, type: 'text' })
  exam_description: string | null;

  @Column({ type: 'varchar', length: 16, default: 'none' })
  recurrence_type: IntakeExamRecurrence;

  /** Interval count: every N days/weeks/months/years depending on recurrence_type. */
  @Column({ type: 'int', default: 1 })
  recurrence_interval: number;

  @Column({ type: 'timestamptz' })
  first_deadline_at: Date;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  /** Optional link to the diagnosis this intake exam was assigned/attached for. */
  @Column({ type: 'uuid', nullable: true })
  diagnosis_id: string | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
