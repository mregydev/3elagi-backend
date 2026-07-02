import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Patient } from './patient.entity';
import { Diagnosis } from './diagnosis.entity';
import { Symptom } from './symptom.entity';
import type { MedicalAiInsight } from '../common/medical-ai-insight.types';

export enum DocumentType {
  XRAY = 'xray',
  LAB = 'lab',
  SYMPTOM = 'symptom',
  PRESCRIPTION = 'prescription',
  DIAGNOSIS = 'diagnosis',
}

@Entity('medical_documents')
export class MedicalDocument {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  patient_id: string;

  @ManyToOne(() => Patient, { eager: false })
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Column({ type: 'enum', enum: DocumentType })
  type: DocumentType;

  @Column({ nullable: true })
  file_url: string;

  @Column({ nullable: true, type: 'text' })
  notes: string;

  @Column({ nullable: true })
  title: string | null;

  @Column({ nullable: true })
  file_name: string;

  @Column({ nullable: true })
  diagnosis_id: string | null;

  @ManyToOne(() => Diagnosis, { eager: false, nullable: true })
  @JoinColumn({ name: 'diagnosis_id' })
  diagnosis: Diagnosis | null;

  @Column({ nullable: true })
  symptom_id: string | null;

  @Column({ type: 'jsonb', nullable: true })
  ai_insight: MedicalAiInsight | null;

  @ManyToOne(() => Symptom, { eager: false, nullable: true })
  @JoinColumn({ name: 'symptom_id' })
  symptom: Symptom | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
