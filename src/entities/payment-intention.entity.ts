import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type PaymentIntentionStatus = 'pending' | 'paid' | 'failed';

/** Tracks a Paymob credits top-up so the webhook can credit exactly once. */
@Entity('payment_intentions')
export class PaymentIntention {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  user_id: string;

  /** EGP credits to grant on success (1 EGP = 1 credit). */
  @Column({ type: 'int' })
  amount_egp: number;

  @Index({ unique: true })
  @Column()
  special_reference: string;

  @Column({ type: 'varchar', length: 16, default: 'pending' })
  status: PaymentIntentionStatus;

  @Column({ type: 'text', nullable: true })
  paymob_transaction_id: string | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
