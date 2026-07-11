import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { AiConversation } from './ai-conversation.entity';

export type AiMessageRole = 'user' | 'assistant';

@Entity('ai_messages')
export class AiMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  conversation_id: string;

  @ManyToOne(() => AiConversation, (c) => c.messages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversation_id' })
  conversation: AiConversation;

  @Column({ type: 'varchar', length: 16 })
  role: AiMessageRole;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'text', nullable: true })
  attachment_url: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  attachment_mime_type: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  attachment_file_name: string | null;

  @CreateDateColumn()
  created_at: Date;
}
