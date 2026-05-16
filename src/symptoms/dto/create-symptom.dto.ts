import { IsString, IsUUID } from 'class-validator';

export class CreateSymptomDto {
  @IsString()
  desc: string;

  @IsUUID()
  diagnosis_id: string;
}
