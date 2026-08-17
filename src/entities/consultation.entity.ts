import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
} from 'typeorm';

/** `pending` = awaiting the doctor's accept/reject. */
export type ConsultationStatus =
  | 'pending'
  | 'open'
  | 'ended'
  | 'cancelled'
  | 'rejected';

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

  /** ISO-2 country the patient consulted from, resolved from their IP. */
  @Column({ type: 'varchar', length: 2, nullable: true })
  patient_country: string | null;

  /**
   * USD value of one credit for that country, read from the admin-set
   * `point_pricing` table when the request was made. Frozen here so a later
   * price change does not re-value past consultations.
   */
  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
  point_price_usd: string | null;

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
