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

  /** Practice country: EG, JO, US, or GB */
  @Column({ type: 'varchar', length: 2, default: 'EG' })
  country: string;

  /** Optional clinic address or city when provided at signup. */
  @Column({ type: 'varchar', length: 512, nullable: true })
  clinic_location: string | null;

  @Column({ type: 'varchar', length: 1024, nullable: true })
  photo_url: string | null;

  /** Text consultation price in the doctor's home currency. */
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  price_local: number | null;

  /** Text consultation price for patients outside the doctor's country (USD). */
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  price_usd: number | null;

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
