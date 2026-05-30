import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Clinic } from './clinic.entity';

@Entity('advertisements')
export class Advertisement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'text' })
  banner_image_url: string;

  @Column({ nullable: true })
  clinic_id: string | null;

  @ManyToOne(() => Clinic, { nullable: true, eager: false })
  @JoinColumn({ name: 'clinic_id' })
  clinic: Clinic | null;

  @Column({ type: 'int', default: 0 })
  sort_order: number;

  @Column({ default: true })
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
