import { IsIn, IsOptional, IsString } from 'class-validator';

export class UpdateUserDto {
  @IsString()
  @IsOptional()
  photo_url?: string | null;

  @IsOptional()
  @IsIn(['ar', 'en'])
  preferred_locale?: 'ar' | 'en' | null;
}
