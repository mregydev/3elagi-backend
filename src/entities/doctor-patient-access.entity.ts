import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Unique,
} from 'typeorm';

@Entity('doctor_patient_access')
@Unique('UQ_doctor_patient_access_pair', ['patient_user_id', 'doctor_id'])
@Index('IDX_doctor_patient_access_patient', ['patient_user_id'])
@Index('IDX_doctor_patient_access_doctor', ['doctor_id'])
export class DoctorPatientAccess {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  patient_user_id: string;

  @Column({ type: 'uuid' })
  doctor_id: string;

  @Column({ type: 'boolean', default: false })
  records_allowed: boolean;

  @Column({ type: 'boolean', default: false })
  blocked_by_patient: boolean;

  @Column({ type: 'boolean', default: false })
  blocked_by_doctor: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  records_allowed_at: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
