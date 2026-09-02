import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { DoctorSpeciality } from './doctor-speciality.entity';
import { User } from './user.entity';

/** One demo patient per speciality for doctor onboarding tours. */
@Entity('specialty_test_accounts')
export class SpecialtyTestAccount {
  @PrimaryColumn('uuid')
  speciality_id: string;

  @ManyToOne(() => DoctorSpeciality, { eager: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'speciality_id' })
  speciality: DoctorSpeciality;

  @Column('uuid')
  patient_user_id: string;

  @ManyToOne(() => User, { eager: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patient_user_id' })
  patient_user: User;

  @CreateDateColumn()
  created_at: Date;
}
