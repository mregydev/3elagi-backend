import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateDoctorFromRegistrationDto {
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;
}
