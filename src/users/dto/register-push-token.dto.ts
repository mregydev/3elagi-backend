import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterPushTokenDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(20)
  @MaxLength(4096)
  token: string;
}
