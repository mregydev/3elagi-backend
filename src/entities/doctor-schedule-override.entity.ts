import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Doctor } from './doctor.entity';

export type ScheduleOverrideScope = 'day' | 'week' | 'month';

@Entity('doctor_schedule_overrides')
@Index('IDX_doctor_schedule_overrides_doctor', ['doctor_id'])
@Index('IDX_doctor_schedule_overrides_dates', ['doctor_id', 'start_date', 'end_date'])
export class DoctorScheduleOverride {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  doctor_id: string;

  @ManyToOne(() => Doctor, { eager: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'doctor_id' })
  doctor: Doctor;

  @Column({ type: 'varchar', length: 8 })
  scope: ScheduleOverrideScope;

  @Column({ type: 'date' })
  start_date: string;

  @Column({ type: 'date' })
  end_date: string;

  @Column({ type: 'boolean', default: false })
  is_closed: boolean;

  @Column({ type: 'time', nullable: true })
  start_time: string | null;

  @Column({ type: 'time', nullable: true })
  end_time: string | null;

  @Column({ type: 'int', nullable: true })
  slot_minutes: number | null;

  @Column({ type: 'varchar', nullable: true })
  note: string | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
