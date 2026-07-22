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
import { DEFAULT_MESSAGE_POINTS } from '../points/points.constants';

export enum UserRole {
  ADMIN = 'admin',
  CLINIC_ADMIN = 'clinic_admin',
  DOCTOR = 'doctor',
  PATIENT = 'patient',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  password_hash: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.DOCTOR })
  role: UserRole;

  @Column({ type: 'text', nullable: true })
  photo_url: string | null;

  @Column({ nullable: true })
  doctor_info_id: string | null;

  @Column({ type: 'int', default: DEFAULT_MESSAGE_POINTS })
  message_points: number;

  /** Points held for open consultations (deducted from message_points until settled). */
  @Column({ type: 'int', default: 0 })
  points_reserved: number;

  @Column({ type: 'int', default: 0 })
  points_spent_total: number;

  @Column({ type: 'int', default: 0 })
  points_purchased_total: number;

  /** Points a doctor has cashed out via reimbursement. */
  @Column({ type: 'int', default: 0 })
  points_reimbursed_total: number;

  @Column({ type: 'varchar', length: 2, nullable: true })
  preferred_locale: 'ar' | 'en' | 'de' | 'es' | null;

  @Column({ type: 'timestamptz', nullable: true })
  email_verified_at: Date | null;

  @Column({ type: 'varchar', nullable: true })
  email_verification_code_hash: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  email_verification_expires_at: Date | null;

  @Column({ type: 'varchar', nullable: true })
  password_reset_token_hash: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  password_reset_expires_at: Date | null;

  @ManyToOne(() => Doctor, { nullable: true, eager: false })
  @JoinColumn({ name: 'doctor_info_id' })
  doctor_info: Doctor | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
