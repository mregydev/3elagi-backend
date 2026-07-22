import { IsEmail, IsString, Length, Matches } from 'class-validator';

export class VerifyEmailDto {
  @IsEmail()
  email: string;

  @IsString()
  @Length(4, 4)
  @Matches(/^\d{4}$/)
  code: string;
}
