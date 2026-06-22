import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Patient } from './patient.entity';
import { Doctor } from './doctor.entity';
import { Symptom } from './symptom.entity';

@Entity('diagnoses')
export class Diagnosis {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  desc: string;

  @Column()
  patient_id: string;

  @ManyToOne(() => Patient, { eager: false })
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Column({ nullable: true })
  doctor_id: string | null;

  @ManyToOne(() => Doctor, { eager: false, nullable: true })
  @JoinColumn({ name: 'doctor_id' })
  doctor: Doctor | null;

  @OneToMany(() => Symptom, (s) => s.diagnosis)
  symptoms: Symptom[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
