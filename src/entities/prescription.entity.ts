import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Doctor } from './doctor.entity';
import { Patient } from './patient.entity';
import { Clinic } from './clinic.entity';

export interface PrescriptionItem {
  name: string;
  dose?: string;
  frequency?: string;
  duration?: string;
  notes?: string;
}

@Entity('prescriptions')
export class Prescription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  doctor_id: string;

  @ManyToOne(() => Doctor, { eager: false })
  @JoinColumn({ name: 'doctor_id' })
  doctor: Doctor;

  @Column()
  patient_id: string;

  @ManyToOne(() => Patient, { eager: false })
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Column({ nullable: true })
  clinic_id: string;

  @ManyToOne(() => Clinic, { nullable: true, eager: false })
  @JoinColumn({ name: 'clinic_id' })
  clinic: Clinic;

  @Column()
  title: string;

  @Column({ nullable: true, type: 'text' })
  symptoms: string;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  items: PrescriptionItem[];

  @Column({ nullable: true })
  pdf_url: string;

  @CreateDateColumn()
  created_at: Date;
}
