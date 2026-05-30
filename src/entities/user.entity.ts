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

  @ManyToOne(() => Doctor, { nullable: true, eager: false })
  @JoinColumn({ name: 'doctor_info_id' })
  doctor_info: Doctor | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
