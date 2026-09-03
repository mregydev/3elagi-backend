import {
  ArrayMinSize,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  MARKETING_EMAIL_LANGUAGES,
  MARKETING_EMAIL_THEMES,
  type MarketingEmailLanguage,
  type MarketingEmailTheme,
} from './send-marketing-email.dto';
import { MarketingEmailSectionDto } from './marketing-email-section.dto';

export class PreviewDoctorWelcomeEmailDto {
  @IsIn(MARKETING_EMAIL_LANGUAGES)
  language!: MarketingEmailLanguage;

  @IsOptional()
  @IsIn(MARKETING_EMAIL_THEMES)
  themeColor?: MarketingEmailTheme;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  previewName?: string;

  @IsOptional()
  @IsEmail()
  previewEmail?: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  @MaxLength(128)
  previewPassword?: string;

  @ValidateNested({ each: true })
  @Type(() => MarketingEmailSectionDto)
  @ArrayMinSize(1)
  sections!: MarketingEmailSectionDto[];
}
