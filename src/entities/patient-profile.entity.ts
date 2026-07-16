import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('patient_profiles')
export class PatientProfile {
  @PrimaryColumn('uuid')
  user_id: string;

  @OneToOne(() => User, { eager: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column()
  name: string;

  @Column()
  phone: string;

  /** ISO 3166-1 alpha-2 residence country. Defaults to Egypt for legacy rows. */
  @Column({ type: 'varchar', length: 2, default: 'EG' })
  country: string;

  @Column({ type: 'date', nullable: true })
  birth_date: string | null;

  @Column({ nullable: true })
  gender: string | null;

  @Column({ type: 'text', nullable: true })
  chronic_conditions: string | null;

  @Column({ type: 'text', nullable: true })
  allergies: string | null;

  @Column({ type: 'text', nullable: true })
  medical_notes: string | null;

  @Column({ type: 'text', nullable: true })
  photo_url: string | null;

  @Column({ type: 'timestamp', nullable: true })
  onboarded_at: Date | null;

  @Column({ type: 'uuid', nullable: true })
  intake_test_id: string | null;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  intake_answers: Record<string, string[]>;

  /** GDPR consent to store medical records in the platform database. */
  @Column({ type: 'boolean', default: false })
  medical_records_storage_consent: boolean;

  @Column({ type: 'timestamp', nullable: true })
  medical_records_storage_consent_at: Date | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
