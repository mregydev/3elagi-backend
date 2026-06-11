import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('ai_usage_logs')
export class AiUsageLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  user_id: string;

  @Column({ type: 'varchar', length: 32 })
  user_role: string;

  @Column({ type: 'uuid', nullable: true })
  conversation_id: string | null;

  @Column({ type: 'text' })
  question: string;

  @Column({ type: 'int', nullable: true })
  tokens_estimated: number | null;

  @Column({ default: false })
  cache_hit: boolean;

  @Column({ type: 'int', nullable: true })
  latency_ms: number | null;

  @CreateDateColumn()
  created_at: Date;
}
