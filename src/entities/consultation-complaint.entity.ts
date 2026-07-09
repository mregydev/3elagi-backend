import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
} from 'typeorm';

export type ComplaintStatus = 'pending' | 'accepted' | 'rejected';

@Entity('consultation_complaints')
@Index('IDX_consultation_complaints_status', ['status'])
export class ConsultationComplaint {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  consultation_id: string;

  @Column({ type: 'uuid' })
  patient_id: string;

  @Column({ type: 'uuid' })
  doctor_id: string;

  /** Reserved points at the time of the complaint (refunded to patient if accepted). */
  @Column({ type: 'int', default: 0 })
  points: number;

  @Column({ type: 'text', default: '' })
  reason: string;

  @Column({ type: 'varchar', length: 16, default: 'pending' })
  status: ComplaintStatus;

  @CreateDateColumn()
  created_at: Date;

  @Column({ type: 'timestamptz', nullable: true })
  resolved_at: Date | null;
}
