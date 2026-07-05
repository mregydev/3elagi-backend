import { IsOptional, IsString } from 'class-validator';

export class TrainRagDocumentChunkDto {
  @IsString()
  upload_id!: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  file_name?: string;

  @IsOptional()
  @IsString()
  mime_type?: string;
}
