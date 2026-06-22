import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Clinic } from './clinic.entity';
import { DoctorSpeciality } from './doctor-speciality.entity';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

@Entity('doctors')
export class Doctor {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  user_id: string;

  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column()
  name: string;

  @Column({ nullable: true })
  age: number;

  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true })
  photo_url: string;

  @Column({ nullable: true })
  graduation_cert_url: string;

  @Column({ nullable: true })
  work_permit_url: string;

  @Column({ nullable: true })
  digital_signature_url: string;

  @Column({ nullable: true })
  personal_clinic_location: string;

  @Column({ nullable: true })
  default_clinic_id: string;

  @ManyToOne(() => Clinic, { nullable: true, eager: false })
  @JoinColumn({ name: 'default_clinic_id' })
  default_clinic: Clinic;

  @Column({ nullable: true })
  email: string;

  @Column({ type: 'text', nullable: true })
  professional_title: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'int', nullable: true })
  experience_years: number | null;

  @Column({ type: 'int', nullable: true })
  consultation_fee_egp: number | null;

  @Column({ type: 'int', default: 1 })
  message_price: number;

  @Column({ type: 'varchar', length: 16, default: 'pending' })
  approval_status: ApprovalStatus;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  faqs: { id: string; q: string; a: string }[];

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  tags: string[];

  @Column({ nullable: true })
  speciality_id: string | null;

  @ManyToOne(() => DoctorSpeciality, { nullable: true, eager: false })
  @JoinColumn({ name: 'speciality_id' })
  speciality: DoctorSpeciality | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
