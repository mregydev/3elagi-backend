import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';
import type { ApprovalStatus } from './doctor.entity';

@Entity('clinics')
export class Clinic {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  phone: string;

  @Column()
  location: string;

  @Column({ nullable: true })
  permission_doc_url: string;

  @Column({ nullable: true })
  logo_url: string;

  @Column({ nullable: true })
  owner_id: string;

  @ManyToOne(() => User, { nullable: true, eager: false })
  @JoinColumn({ name: 'owner_id' })
  owner: User;

  @Column({ default: false })
  is_personal: boolean;

  @Column({ type: 'varchar', length: 16, default: 'pending' })
  approval_status: ApprovalStatus;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
