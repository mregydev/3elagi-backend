import {
  ArrayMinSize,
  IsBoolean,
  IsIn,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { RegisterDoctorDto } from '../../auth/dto/register-doctor.dto';
import {
  MARKETING_EMAIL_LANGUAGES,
  MARKETING_EMAIL_THEMES,
  type MarketingEmailLanguage,
  type MarketingEmailTheme,
} from './send-marketing-email.dto';
import { MarketingEmailSectionDto } from './marketing-email-section.dto';

export class CreateAdminDoctorDto extends RegisterDoctorDto {
  @IsOptional()
  @IsBoolean()
  send_welcome_email?: boolean;

  @IsOptional()
  @IsIn(MARKETING_EMAIL_LANGUAGES)
  welcome_email_language?: MarketingEmailLanguage;

  @IsOptional()
  @IsIn(MARKETING_EMAIL_THEMES)
  welcome_email_theme?: MarketingEmailTheme;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => MarketingEmailSectionDto)
  @ArrayMinSize(1)
  welcome_email_sections?: MarketingEmailSectionDto[];
}
