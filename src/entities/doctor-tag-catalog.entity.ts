import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { DoctorSpeciality } from './doctor-speciality.entity';

@Entity('doctor_tag_catalog')
export class DoctorTagCatalog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 40 })
  label: string;

  @Column({ length: 40, unique: true })
  label_normalized: string;

  @Column({ type: 'uuid', nullable: true })
  speciality_id: string | null;

  @ManyToOne(() => DoctorSpeciality, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'speciality_id' })
  speciality?: DoctorSpeciality | null;

  /** True for admin-seeded predefined tags; false when created by a doctor. */
  @Column({ type: 'boolean', default: false })
  is_seeded: boolean;

  @CreateDateColumn()
  created_at: Date;
}
