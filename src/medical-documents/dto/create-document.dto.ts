import { IsString, IsOptional, IsEnum, IsUUID, IsIn } from 'class-validator';
import { DocumentType } from '../../entities/medical-document.entity';
import { MEDICAL_BODY_PARTS } from '../../common/medical-body-part';

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
  title?: string;

  @IsString()
  @IsOptional()
  file_name?: string;

  @IsOptional()
  @IsIn([...MEDICAL_BODY_PARTS])
  body_part?: string | null;

  @IsUUID()
  @IsOptional()
  diagnosis_id?: string;

  @IsUUID()
  @IsOptional()
  symptom_id?: string;
}
