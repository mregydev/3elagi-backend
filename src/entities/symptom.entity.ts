import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Diagnosis } from './diagnosis.entity';
import { Doctor } from './doctor.entity';

@Entity('symptoms')
export class Symptom {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  desc: string;

  @Column()
  diagnosis_id: string;

  @ManyToOne(() => Diagnosis, (d) => d.symptoms, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'diagnosis_id' })
  diagnosis: Diagnosis;

  @Column({ type: 'uuid', nullable: true })
  doctor_id: string | null;

  @ManyToOne(() => Doctor, { eager: false, nullable: true })
  @JoinColumn({ name: 'doctor_id' })
  doctor: Doctor | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
