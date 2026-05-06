import { IsString, IsOptional } from 'class-validator';

export class CreateClinicDto {
  @IsString()
  name: string;

  @IsString()
  phone: string;

  @IsString()
  location: string;

  @IsString()
  @IsOptional()
  permission_doc_url?: string;

  @IsString()
  @IsOptional()
  logo_url?: string;
}
