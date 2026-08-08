import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { PushNotificationType } from '../push-notifications/push.types';

@Entity('user_notifications')
@Index(['user_id', 'created_at'])
@Index(['user_id', 'read_at'])
export class UserNotification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  user_id: string;

  @Column({ type: 'varchar', length: 48 })
  type: PushNotificationType;

  @Column({ type: 'varchar', length: 160 })
  title: string;

  @Column({ type: 'text' })
  body: string;

  /** Deep-link payload (chatId, messageId, sessionId, …). */
  @Column({ type: 'jsonb', default: {} })
  data: Record<string, string>;

  @Column({ type: 'timestamptz', nullable: true })
  read_at: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
