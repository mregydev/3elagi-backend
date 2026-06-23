import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type DeviceTokenPlatform = 'android' | 'ios' | 'web';

@Entity('device_tokens')
@Index(['user_id', 'token'], { unique: true })
export class DeviceToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  user_id: string;

  @Column('text')
  token: string;

  @Column({ type: 'varchar', length: 16 })
  platform: DeviceTokenPlatform;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
