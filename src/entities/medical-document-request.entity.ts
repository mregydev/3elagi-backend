import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Doctor } from './doctor.entity';
import { User } from './user.entity';
import { MedicalDocument } from './medical-document.entity';

export enum MedicalDocumentRequestType {
  LAB = 'lab',
  XRAY = 'xray',
}

export enum MedicalDocumentRequestStatus {
  PENDING = 'pending',
  FULFILLED = 'fulfilled',
  CANCELLED = 'cancelled',
}

@Entity('medical_document_requests')
export class MedicalDocumentRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  doctor_id: string;

  @ManyToOne(() => Doctor, { eager: false })
  @JoinColumn({ name: 'doctor_id' })
  doctor: Doctor;

  /** Registered app user (users.id) this request was made for. */
  @Column({ type: 'uuid' })
  patient_user_id: string;

  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: 'patient_user_id' })
  patient_user: User;

  @Column({ type: 'varchar', length: 16 })
  type: MedicalDocumentRequestType;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({
    type: 'varchar',
    length: 16,
    default: MedicalDocumentRequestStatus.PENDING,
  })
  status: MedicalDocumentRequestStatus;

  /** Medical document the patient linked/uploaded to satisfy this request. */
  @Column({ type: 'uuid', nullable: true })
  fulfilled_document_id: string | null;

  @ManyToOne(() => MedicalDocument, { eager: false, nullable: true })
  @JoinColumn({ name: 'fulfilled_document_id' })
  fulfilled_document: MedicalDocument | null;

  /** Cached generated PDF (title/description + doctor signature) for printing/download. */
  @Column({ nullable: true })
  pdf_url: string | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
