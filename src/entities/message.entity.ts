import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';

export type MessageType =
  | 'text'
  | 'image'
  | 'video'
  | 'voice'
  | 'medical_link'
  | 'access_action'
  | 'appointment_action'
  | 'consultation_action';

export interface MedicalLinkMeta {
  record_type: 'lab' | 'xray' | 'diagnosis' | 'intake';
  record_id: string;
  title: string;
  note?: string;
}

export type AccessActionType =
  | 'grant_records'
  | 'revoke_records'
  | 'patient_block'
  | 'doctor_block'
  | 'patient_unblock'
  | 'doctor_unblock';

export interface AccessActionMeta {
  action: AccessActionType;
}

export type AppointmentActionType =
  | 'request'
  | 'confirm'
  | 'reject'
  | 'cancel';

export interface AppointmentActionMeta {
  appointment_id: string;
  action: AppointmentActionType;
  date: string;
  time: string;
  status?: string;
  meeting_link?: string | null;
}

export type ConsultationActionType = 'start' | 'end' | 'cancel';

export interface ConsultationActionMeta {
  consultation_id: string;
  action: ConsultationActionType;
  status: 'open' | 'ended' | 'cancelled';
  reserved_points?: number;
  cancel_reason_type?: 'video_consultation' | 'onsite_visit' | 'other';
  cancel_reason?: string;
  diagnosis_id?: string | null;
}

export type MessageAttachmentMeta =
  | MedicalLinkMeta
  | AccessActionMeta
  | AppointmentActionMeta
  | ConsultationActionMeta;

@Entity('messages')
@Index('IDX_messages_creator_recipient', ['creator', 'recipient'])
@Index('IDX_messages_recipient_creator', ['recipient', 'creator'])
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 32, default: 'text' })
  type: MessageType;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'text', nullable: true })
  attachment_url: string | null;

  @Column({ type: 'jsonb', nullable: true })
  attachment_meta: MessageAttachmentMeta | null;

  @Column({ type: 'uuid' })
  creator: string;

  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: 'creator' })
  creator_user: User;

  @Column({ type: 'uuid' })
  recipient: string;

  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: 'recipient' })
  recipient_user: User;

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  datetime: Date;

  @Column({ type: 'timestamptz', nullable: true })
  read_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  edited_at: Date | null;
}
