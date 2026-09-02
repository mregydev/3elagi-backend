import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MARKETING_SECTION_TYPES } from '../../mail/marketing-email-sections';

export class MarketingEmailSectionDto {
  @IsString()
  id!: string;

  @IsIn([...MARKETING_SECTION_TYPES])
  type!: (typeof MARKETING_SECTION_TYPES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(20_000)
  html?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  title?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  items?: string[];

  @IsOptional()
  @IsIn(['accent', 'soft', 'highlight'])
  variant?: 'accent' | 'soft' | 'highlight';

  @IsOptional()
  @IsString()
  @MaxLength(120)
  buttonLabel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  buttonUrl?: string;
}
