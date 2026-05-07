import { IsString, IsOptional, IsUUID } from 'class-validator';

export class CreateClinicDto {
  @IsUUID()
  @IsOptional()
  owner_id?: string;

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
