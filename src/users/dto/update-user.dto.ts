import { IsIn, IsOptional, IsString } from 'class-validator';

export class UpdateUserDto {
  @IsString()
  @IsOptional()
  photo_url?: string | null;

  @IsOptional()
  @IsIn(['ar', 'en', 'de', 'es'])
  preferred_locale?: 'ar' | 'en' | 'de' | 'es' | null;
}
