import {
  ArrayMaxSize,
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

export class SendDoctorWelcomeEmailBatchDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsString()
  @MinLength(6)
  @MaxLength(128)
  password!: string;

  @IsEmail({}, { each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  emails!: string[];

  @IsIn(MARKETING_EMAIL_LANGUAGES)
  language!: MarketingEmailLanguage;

  @IsOptional()
  @IsIn(MARKETING_EMAIL_THEMES)
  themeColor?: MarketingEmailTheme;

  @ValidateNested({ each: true })
  @Type(() => MarketingEmailSectionDto)
  @ArrayMinSize(1)
  sections!: MarketingEmailSectionDto[];
}
