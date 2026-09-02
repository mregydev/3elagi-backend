import {
  ArrayMaxSize,
  ArrayMinSize,
  IsEmail,
  IsIn,
  IsNotEmpty,
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

export class MarketingEmailRecipientDto {
  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;
}

export class SendMarketingEmailBatchDto {
  @ValidateNested({ each: true })
  @Type(() => MarketingEmailRecipientDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  recipients!: MarketingEmailRecipientDto[];

  @IsIn(MARKETING_EMAIL_LANGUAGES)
  language!: MarketingEmailLanguage;

  @IsOptional()
  @IsString()
  @MaxLength(100_000)
  bodyHtml?: string;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => MarketingEmailSectionDto)
  sections?: MarketingEmailSectionDto[];

  @IsOptional()
  @IsIn(MARKETING_EMAIL_THEMES)
  themeColor?: MarketingEmailTheme;
}
