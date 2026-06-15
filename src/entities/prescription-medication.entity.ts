import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Prescription } from './prescription.entity';

@Entity('prescription_medications')
export class PrescriptionMedication {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  prescription_id: string;

  @ManyToOne(() => Prescription, (prescription) => prescription.medications, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'prescription_id' })
  prescription: Prescription;

  @Column()
  medication_name: string;

  @Column({ nullable: true })
  interval: string | null;

  @Column({ nullable: true })
  dose: string | null;

  @Column({ nullable: true, type: 'text' })
  notes: string | null;

  @CreateDateColumn()
  created_at: Date;
}
