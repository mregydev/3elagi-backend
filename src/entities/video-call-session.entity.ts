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

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
