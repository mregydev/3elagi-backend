import { IsEnum, IsIn, IsOptional, IsString, IsUUID } from 'class-validator';
import { MedicalDocumentRequestType } from '../../entities/medical-document-request.entity';
import type { ApiLocale } from '../../common/resolve-api-locale';

export class AiDraftRequestDescriptionDto {
  @IsUUID()
  patient_user_id: string;

  @IsEnum(MedicalDocumentRequestType)
  type: MedicalDocumentRequestType;

  @IsString()
  title: string;

  @IsOptional()
  @IsIn(['ar', 'en', 'de', 'es'])
  lang?: ApiLocale;
}
