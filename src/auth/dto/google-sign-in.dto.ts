import { IsBoolean, IsOptional, IsString } from 'class-validator';

/** Web OAuth sends `code`; native apps send `id_token`. */
export class GoogleSignInDto {
  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  redirect_uri?: string;

  @IsOptional()
  @IsString()
  id_token?: string;

  @IsOptional()
  @IsBoolean()
  medical_records_storage_consent?: boolean;
}
