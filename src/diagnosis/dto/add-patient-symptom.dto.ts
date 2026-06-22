import { IsString } from 'class-validator';

export class AddPatientSymptomDto {
  @IsString()
  desc: string;
}
