import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type SpecialityChangeRequestStatus = 'pending' | 'approved' | 'rejected';

@Entity('doctor_speciality_change_requests')
export class DoctorSpecialityChangeRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  doctor_id: string;

  @Column({ type: 'uuid' })
  doctor_user_id: string;

  @Column({ type: 'varchar', length: 255 })
  doctor_name: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  doctor_email: string | null;

  @Column({ type: 'uuid', nullable: true })
  current_speciality_id: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  current_speciality_name_en: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  current_speciality_name_ar: string | null;

  @Column({ type: 'uuid' })
  requested_speciality_id: string;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  requested_speciality_ids: string[];

  @Column({ type: 'varchar', length: 255 })
  requested_speciality_name_en: string;

  @Column({ type: 'varchar', length: 255 })
  requested_speciality_name_ar: string;

  @Column({ type: 'varchar', length: 16, default: 'pending' })
  status: SpecialityChangeRequestStatus;

  @Column({ type: 'timestamptz', nullable: true })
  reviewed_at: Date | null;

  @Column({ type: 'uuid', nullable: true })
  reviewed_by_user_id: string | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
