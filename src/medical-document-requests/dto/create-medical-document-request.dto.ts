import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { MedicalDocumentRequestType } from '../../entities/medical-document-request.entity';

export class CreateMedicalDocumentRequestDto {
  @IsUUID()
  patient_user_id: string;

  @IsEnum(MedicalDocumentRequestType)
  type: MedicalDocumentRequestType;

  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;
}
