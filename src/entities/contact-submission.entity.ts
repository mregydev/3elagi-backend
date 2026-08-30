import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type ContactSubmissionAttachment = {
  file_name: string;
  mime_type: string;
  url: string;
  object_path?: string | null;
};

@Entity('contact_submissions')
export class ContactSubmission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  user_id: string | null;

  @Column({ type: 'varchar', length: 255 })
  sender_name: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  sender_email: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  sender_role: string | null;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  attachments: ContactSubmissionAttachment[];

  @Column({ type: 'timestamptz', nullable: true })
  read_at: Date | null;

  @CreateDateColumn()
  created_at: Date;
}
