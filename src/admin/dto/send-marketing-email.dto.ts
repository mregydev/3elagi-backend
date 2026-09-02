import { IsEmail, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export const MARKETING_EMAIL_LANGUAGES = ['en', 'ar', 'es', 'de'] as const;
export type MarketingEmailLanguage = (typeof MARKETING_EMAIL_LANGUAGES)[number];

export class SendMarketingEmailDto {
  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsIn(MARKETING_EMAIL_LANGUAGES)
  language!: MarketingEmailLanguage;

  /** Custom HTML body. Use {{name}} for the doctor name. Header/footer are added automatically. */
  @IsOptional()
  @IsString()
  @MaxLength(100_000)
  bodyHtml?: string;
}
