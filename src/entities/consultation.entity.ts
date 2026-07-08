import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
} from 'typeorm';

export type ConsultationStatus = 'open' | 'ended' | 'cancelled';

export type ConsultationCancelReasonType =
  | 'video_consultation'
  | 'onsite_visit'
  | 'other';

@Entity('consultations')
@Index('IDX_consultations_patient', ['patient_id'])
@Index('IDX_consultations_doctor', ['doctor_id'])
export class Consultation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Patient user id. */
  @Column({ type: 'uuid' })
  patient_id: string;

  /** Doctor user id. */
  @Column({ type: 'uuid' })
  doctor_id: string;

  @Column({ type: 'varchar', length: 16, default: 'open' })
  status: ConsultationStatus;

  @Column({ type: 'text', default: '' })
  description: string;

  @Column({ type: 'int', default: 0 })
  reserved_points: number;

  /** Doctor's closing note, set on end. */
  @Column({ type: 'text', nullable: true })
  doctor_note: string | null;

  /** Diagnosis record created on end, if any. */
  @Column({ type: 'uuid', nullable: true })
  diagnosis_id: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  cancel_reason_type: ConsultationCancelReasonType | null;

  @Column({ type: 'text', nullable: true })
  cancel_reason: string | null;

  @CreateDateColumn()
  created_at: Date;

  @Column({ type: 'timestamptz', nullable: true })
  closed_at: Date | null;
}
