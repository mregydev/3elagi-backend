import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('doctor_specialities')
export class DoctorSpeciality {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name_en: string;

  @Column()
  name_ar: string;

  @Column({ type: 'text' })
  image_url: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
