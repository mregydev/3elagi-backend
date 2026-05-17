import { IsString, IsOptional, IsEnum, IsUUID } from 'class-validator';
import { DocumentType } from '../../entities/medical-document.entity';

export class CreateDocumentDto {
  /** Patient user id (users.id); stored in medical_documents.patient_id. */
  @IsUUID()
  patient_id: string;

  @IsEnum(DocumentType)
  type: DocumentType;

  @IsString()
  @IsOptional()
  file_url?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  file_name?: string;

  @IsUUID()
  @IsOptional()
  diagnosis_id?: string;

  @IsUUID()
  @IsOptional()
  symptom_id?: string;
}
