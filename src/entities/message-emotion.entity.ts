import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Unique,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

export type MessageEmotionSource = 'chat' | 'ai';

export type MessageEmotionType = 'love' | 'like' | 'laugh' | 'thumbsup' | 'dislike';

@Entity('message_emotions')
@Unique('UQ_message_emotion_user', ['message_id', 'message_source', 'user_id'])
@Index('IDX_message_emotions_message', ['message_id', 'message_source'])
@Index('IDX_message_emotions_user', ['user_id'])
export class MessageEmotion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  message_id: string;

  @Column({ type: 'varchar', length: 8 })
  message_source: MessageEmotionSource;

  @Column({ type: 'uuid' })
  user_id: string;

  @ManyToOne(() => User, { eager: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'varchar', length: 16 })
  emotion: MessageEmotionType;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
