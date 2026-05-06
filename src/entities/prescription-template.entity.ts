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
import { PrescriptionItem } from './prescription.entity';

@Entity('prescription_templates')
export class PrescriptionTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  doctor_id: string;

  @ManyToOne(() => Doctor, { eager: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'doctor_id' })
  doctor: Doctor;

  @Column()
  name: string;

  @Column({ nullable: true })
  title: string;

  @Column({ nullable: true, type: 'text' })
  symptoms: string;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  items: PrescriptionItem[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
