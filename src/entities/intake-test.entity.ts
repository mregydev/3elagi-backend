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

export type IntakeQuestionType =
  | 'text'
  | 'single_choice'
  | 'multi_choice'
  | 'guidance';

export interface IntakeOption {
  id: string;
  text: string;
}

export interface IntakeQuestion {
  id: string;
  text: string;
  type: IntakeQuestionType;
  required: boolean;
  options: IntakeOption[];
}

@Entity('intake_tests')
export class IntakeTest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  doctor_id: string | null;

  @ManyToOne(() => Doctor, { eager: false, onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'doctor_id' })
  doctor: Doctor | null;

  @Column()
  name: string;

  @Column({ nullable: true, type: 'text' })
  description: string | null;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @Column({ type: 'boolean', default: false })
  is_default_template: boolean;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  questions: IntakeQuestion[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
