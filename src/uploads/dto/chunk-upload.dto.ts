import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class InitChunkUploadDto {
  @IsString()
  filename!: string;

  @IsOptional()
  @IsString()
  mime_type?: string;

  @IsInt()
  @Min(1)
  total_size!: number;

  @IsInt()
  @Min(1)
  @Max(500)
  total_chunks!: number;
}

export class CompleteChunkUploadDto {
  @IsString()
  upload_id!: string;
}
