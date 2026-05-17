import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Clinic } from './clinic.entity';

@Entity('patients')
export class Patient {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  clinic_id: string;

  @ManyToOne(() => Clinic, { eager: false })
  @JoinColumn({ name: 'clinic_id' })
  clinic: Clinic;

  @Column()
  name: string;

  @Column({ nullable: true, type: 'date' })
  birth_date: string;

  @Column()
  phone: string;

  @Column({ nullable: true })
  age: number;

  @Column({ type: 'text', nullable: true })
  photo_url: string | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
