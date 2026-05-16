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

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
