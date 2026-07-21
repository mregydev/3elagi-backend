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

  /**
   * Credits to grant on success.
   * Cash charged is `amount_money` in `currency` (see market pricing).
   */
  @Column({ type: 'int' })
  amount_egp: number;

  /** ISO currency charged via Paymob (EGP | JOD). */
  @Column({ type: 'varchar', length: 3, default: 'EGP' })
  currency: string;

  /** Major-unit cash amount charged (e.g. 100 EGP or 5 JOD). */
  @Column({ type: 'int' })
  amount_money: number;

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
