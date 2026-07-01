import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class SttDto {
  @IsString()
  @IsNotEmpty()
  /** Base64-encoded audio payload. */
  audio!: string;

  @IsOptional()
  @IsString()
  mimeType?: string;

  @IsOptional()
  @IsString()
  languageCode?: string;
}
