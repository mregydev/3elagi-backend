import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Doctor } from './doctor.entity';
import { Patient } from './patient.entity';
import { Clinic } from './clinic.entity';
import { PrescriptionMedication } from './prescription-medication.entity';
import type { MedicalAiInsight } from '../common/medical-ai-insight.types';

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

  @Column({ nullable: true })
  doctor_id: string | null;

  @ManyToOne(() => Doctor, { eager: false, nullable: true })
  @JoinColumn({ name: 'doctor_id' })
  doctor: Doctor;

  @Column({ nullable: true })
  patient_id: string | null;

  @ManyToOne(() => Patient, { eager: false, nullable: true })
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  /** Registered app user (users.id) for mobile medical records. */
  @Column({ nullable: true })
  patient_user_id: string | null;

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

  @OneToMany(() => PrescriptionMedication, (medication) => medication.prescription, {
    cascade: true,
  })
  medications: PrescriptionMedication[];

  @Column({ nullable: true })
  pdf_url: string;

  /** Scanned/uploaded prescription photo saved with the record. */
  @Column({ nullable: true })
  image_url: string;

  @Column({ type: 'jsonb', nullable: true })
  ai_insight: MedicalAiInsight | null;

  @CreateDateColumn()
  created_at: Date;
}
