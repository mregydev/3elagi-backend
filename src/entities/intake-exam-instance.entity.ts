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
import { IntakeExamAssignment } from './intake-exam-assignment.entity';
import type { IntakeQuestion } from './intake-test.entity';

export type IntakeExamInstanceStatus = 'pending' | 'in_progress' | 'completed';

@Entity('intake_exam_instances')
export class IntakeExamInstance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  assignment_id: string;

  @ManyToOne(() => IntakeExamAssignment, { eager: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'assignment_id' })
  assignment: IntakeExamAssignment;

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

  @Column({ type: 'int', default: 1 })
  instance_number: number;

  @Column({ type: 'timestamptz' })
  deadline_at: Date;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  questions: IntakeQuestion[];

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  answers: Record<string, string[]>;

  @Column({ type: 'varchar', length: 16, default: 'pending' })
  status: IntakeExamInstanceStatus;

  @Column({ type: 'timestamptz', nullable: true })
  reminder_sent_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  completed_at: Date | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
