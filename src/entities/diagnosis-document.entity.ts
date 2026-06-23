import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { Diagnosis } from './diagnosis.entity';
import { MedicalDocument } from './medical-document.entity';

@Entity('diagnosis_documents')
@Unique('UQ_diagnosis_documents_pair', ['diagnosis_id', 'medical_document_id'])
export class DiagnosisDocument {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  diagnosis_id: string;

  @ManyToOne(() => Diagnosis, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'diagnosis_id' })
  diagnosis: Diagnosis;

  @Column()
  medical_document_id: string;

  @ManyToOne(() => MedicalDocument, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'medical_document_id' })
  medical_document: MedicalDocument;

  @CreateDateColumn()
  created_at: Date;
}
