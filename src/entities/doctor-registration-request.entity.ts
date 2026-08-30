import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('doctor_registration_requests')
export class DoctorRegistrationRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  doctor_name: string;

  @Column({ type: 'varchar', length: 255 })
  email: string;

  @Column({ type: 'varchar', length: 64 })
  phone: string;

  /** Practice country: EG or JO */
  @Column({ type: 'varchar', length: 2, default: 'EG' })
  country: string;

  @Column({ type: 'uuid' })
  speciality_id: string;

  @Column({ type: 'varchar', length: 255 })
  speciality_name_en: string;

  @Column({ type: 'varchar', length: 255 })
  speciality_name_ar: string;

  @Column({ type: 'timestamptz', nullable: true })
  read_at: Date | null;

  @CreateDateColumn()
  created_at: Date;
}
