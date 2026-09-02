import {
  ArrayMinSize,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
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

export class PreviewMarketingEmailDto {
  @IsIn(MARKETING_EMAIL_LANGUAGES)
  language!: MarketingEmailLanguage;

  @IsOptional()
  @IsIn(MARKETING_EMAIL_THEMES)
  themeColor?: MarketingEmailTheme;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  previewName?: string;

  @ValidateNested({ each: true })
  @Type(() => MarketingEmailSectionDto)
  @ArrayMinSize(1)
  sections!: MarketingEmailSectionDto[];
}
