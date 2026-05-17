import { IsString, IsOptional, IsNotEmpty } from 'class-validator';

export class UploadFileBase64Dto {
  /** Raw base64 or data URL (`data:image/jpeg;base64,...`) */
  @IsString()
  @IsNotEmpty()
  file: string;

  @IsString()
  @IsNotEmpty()
  filename: string;

  @IsString()
  @IsOptional()
  mimetype?: string;
}
