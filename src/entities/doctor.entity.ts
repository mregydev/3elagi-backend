import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  ManyToMany,
  JoinColumn,
  JoinTable,
} from 'typeorm';
import { User } from './user.entity';
import { Clinic } from './clinic.entity';
import { DoctorSpeciality } from './doctor-speciality.entity';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

@Entity('doctors')
export class Doctor {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  user_id: string;

  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column()
  name: string;

  /** ISO 3166-1 alpha-2 practice / residence country. Defaults to Egypt for legacy rows. */
  @Column({ type: 'varchar', length: 2, default: 'EG' })
  country: string;

  @Column({ nullable: true })
  age: number;

  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true })
  photo_url: string;

  @Column({ nullable: true })
  graduation_cert_url: string;

  @Column({ nullable: true })
  work_permit_url: string;

  @Column({ nullable: true })
  digital_signature_url: string;

  @Column({ nullable: true })
  personal_clinic_location: string;

  @Column({ nullable: true })
  default_clinic_id: string;

  @ManyToOne(() => Clinic, { nullable: true, eager: false })
  @JoinColumn({ name: 'default_clinic_id' })
  default_clinic: Clinic;

  @Column({ nullable: true })
  email: string;

  @Column({ type: 'text', nullable: true })
  professional_title: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'int', nullable: true })
  experience_years: number | null;

  @Column({ type: 'int', nullable: true })
  consultation_fee_egp: number | null;

  /** Per-message price in EGP credits. */
  @Column({ type: 'int', default: 1 })
  message_price: number;

  /** EGP credits a patient must reserve to start a consultation with this doctor. */
  @Column({ type: 'int', default: 1 })
  consultation_price: number;

  /** EGP credits a patient must reserve to book a video appointment with this doctor. */
  @Column({ type: 'int', default: 1 })
  video_consultation_price: number;

  /** Video consultation duration in minutes (30, 60 or 120). */
  @Column({ type: 'int', default: 30 })
  video_consultation_minutes: number;

  /**
   * Cash fees the doctor charges, paid outside the app through `payment_link`.
   * `_local` is in the doctor's own currency (EGP in Egypt, JOD in Jordan) and
   * applies to patients in the doctor's country; `_usd` applies to everyone else.
   */
  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
  text_price_local: string | null;

  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
  text_price_usd: string | null;

  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
  video_price_local: string | null;

  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
  video_price_usd: string | null;

  /** Where the patient pays (bank/wallet/Stripe link the doctor owns). */
  @Column({ type: 'text', nullable: true })
  payment_link: string | null;

  /** Doctor accepts immediate (unscheduled) calls straight from the chat. */
  @Column({ type: 'boolean', default: false })
  immediate_call_enabled: boolean;

  @Column({ type: 'varchar', length: 16, default: 'pending' })
  approval_status: ApprovalStatus;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  faqs: { id: string; q: string; a: string }[];

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  tags: string[];

  /** Uploaded certifications: file URL (PDF/image) + doctor's description. */
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  certification_urls: { url: string; description: string }[];

  @Column({ nullable: true })
  speciality_id: string | null;

  @ManyToOne(() => DoctorSpeciality, { nullable: true, eager: false })
  @JoinColumn({ name: 'speciality_id' })
  speciality: DoctorSpeciality | null;

  /**
   * Every speciality the doctor practises. `speciality_id` above stays the
   * primary one — it is what browse, presence and the AI index read.
   */
  @ManyToMany(() => DoctorSpeciality, { eager: false })
  @JoinTable({
    name: 'doctor_speciality_links',
    joinColumn: { name: 'doctor_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'speciality_id', referencedColumnName: 'id' },
  })
  specialities: DoctorSpeciality[];

  /** Bank account IBAN for payouts (doctor-only; never expose publicly). */
  @Column({ type: 'varchar', length: 64, nullable: true })
  iban: string | null;

  /** Full name on the bank account. */
  @Column({ type: 'varchar', length: 200, nullable: true })
  account_holder_full_name: string | null;

  /** National ID / national number for payout verification. */
  @Column({ type: 'varchar', length: 32, nullable: true })
  national_id: string | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  /** Set when the doctor finishes the main product walkthrough. */
  @Column({ type: 'timestamptz', nullable: true })
  product_tour_completed_at: Date | null;

  /** Set when the doctor finishes the profile / pricing walkthrough. */
  @Column({ type: 'timestamptz', nullable: true })
  profile_tour_completed_at: Date | null;

  /** Linked specialty test patient for the onboarding tour. */
  @Column({ type: 'uuid', nullable: true })
  onboarding_test_patient_user_id: string | null;
}
