import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('doctor_specialities')
export class DoctorSpeciality {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name_en: string;

  @Column()
  name_ar: string;

  @Column({ type: 'text' })
  image_url: string;

  /** Shown on Egypt market browse (home / our doctors). */
  @Column({ type: 'boolean', default: true })
  visible_eg: boolean;

  /** Shown on Jordan market browse (home / our doctors). */
  @Column({ type: 'boolean', default: true })
  visible_jo: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
