import { IsString } from 'class-validator';

export class CreateDiagnosisSymptomDto {
  @IsString()
  desc: string;
}
