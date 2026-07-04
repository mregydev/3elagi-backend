import { IsBoolean, IsObject, IsOptional } from 'class-validator';

export class SaveIntakeExamAnswersDto {
  @IsObject()
  answers: Record<string, string[]>;

  @IsOptional()
  @IsBoolean()
  complete?: boolean;
}
