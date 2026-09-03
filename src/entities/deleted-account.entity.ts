import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type DeletedAccountType = 'patient' | 'doctor';
export type DeletedAccountSource = 'self' | 'admin';

@Entity('deleted_accounts')
export class DeletedAccount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Original users.id at deletion time. */
  @Column({ type: 'uuid' })
  user_id: string;

  @Column({ type: 'varchar', length: 16 })
  account_type: DeletedAccountType;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 255 })
  email: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', length: 2, nullable: true })
  country: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  speciality_name: string | null;

  @Column({ type: 'varchar', length: 16, default: 'self' })
  deleted_by: DeletedAccountSource;

  @CreateDateColumn()
  deleted_at: Date;
}
