import { IsOptional, IsString } from 'class-validator';

export class UpdatePatientMedicalDocumentDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
