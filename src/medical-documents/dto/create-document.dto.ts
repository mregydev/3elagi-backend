import { IsString, IsOptional, IsEnum } from 'class-validator';
import { DocumentType } from '../../entities/medical-document.entity';

export class CreateDocumentDto {
  @IsString()
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
}
