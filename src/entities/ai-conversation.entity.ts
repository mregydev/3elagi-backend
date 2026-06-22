import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { AiMessage } from './ai-message.entity';

@Entity('ai_conversations')
export class AiConversation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  user_id: string;

  @Column({ type: 'uuid', nullable: true })
  patient_context_id: string | null;

  @Column({ default: 'New chat' })
  title: string;

  @OneToMany(() => AiMessage, (m) => m.conversation)
  messages: AiMessage[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
