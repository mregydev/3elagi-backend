import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type AdminRagSourceKind = 'text' | 'document';

@Entity('admin_rag_sources')
export class AdminRagSource {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 16 })
  kind: AdminRagSourceKind;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'text', nullable: true })
  file_url: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  file_name: string | null;

  @Column({ type: 'varchar', length: 160, nullable: true })
  mime_type: string | null;

  @Column({ type: 'uuid', nullable: true })
  created_by: string | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
