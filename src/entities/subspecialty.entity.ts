import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { DoctorSpeciality } from './doctor-speciality.entity';

@Entity('subspecialties')
export class Subspecialty {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 40 })
  name_en: string;

  @Column({ length: 40, unique: true })
  name_normalized: string;

  @Column({ length: 40, nullable: true })
  name_ar: string | null;

  @Column({ length: 40, nullable: true })
  name_de: string | null;

  @Column({ length: 40, nullable: true })
  name_es: string | null;

  @Column({ type: 'uuid' })
  speciality_id: string;

  @ManyToOne(() => DoctorSpeciality, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'speciality_id' })
  speciality?: DoctorSpeciality;

  /** True for admin-seeded rows; false when created by a doctor. */
  @Column({ type: 'boolean', default: false })
  is_seeded: boolean;

  @CreateDateColumn()
  created_at: Date;
}
