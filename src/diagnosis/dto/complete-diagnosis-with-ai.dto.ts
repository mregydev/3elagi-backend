import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';
import type { ApiLocale } from '../../common/resolve-api-locale';

export class CompleteDiagnosisWithAiDto {
  /** Patient's user id (users.id), same identifier used by CreateDiagnosisDto.patient_id. */
  @IsUUID()
  patient_id: string;

  @IsString()
  desc: string;

  @IsOptional()
  @IsIn(['ar', 'en', 'de', 'es'])
  lang?: ApiLocale;
}
