import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type VideoCallStatus =
  | 'ringing'
  | 'accepted'
  | 'ended'
  | 'declined'
  | 'missed';

@Entity('video_call_sessions')
export class VideoCallSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  patient_user_id: string;

  @Column('uuid')
  doctor_user_id: string;

  @Column({ type: 'text' })
  room_url: string;

  @Column({ type: 'varchar', length: 16, default: 'ringing' })
  status: VideoCallStatus;

  @Column({ type: 'text' })
  patient_name: string;

  @Column({ type: 'text' })
  doctor_name: string;

  /** Meeting length in minutes (the doctor's video consultation length). */
  @Column({ type: 'int', nullable: true })
  duration_minutes: number | null;

  /** Credits held from the patient while the call is live (0 = nothing held). */
  @Column({ type: 'int', default: 0 })
  reserved_points: number;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
