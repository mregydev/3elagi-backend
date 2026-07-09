import { IsIn, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class FileComplaintDto {
  @IsUUID()
  consultation_id: string;

  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  reason: string;
}

export class ResolveComplaintDto {
  @IsIn(['accept', 'reject'])
  action: 'accept' | 'reject';
}
